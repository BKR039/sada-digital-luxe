// ============================================================
// SADA OS — SMART PACKAGE MATCHING ENGINE & SERVICE
// Deterministic, explainable, database-driven recommendation engine
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_PACKAGE_SELECT } from "@/lib/package-service";
import type { PackageCatalogItem } from "@/types/package-catalog";
import type {
  CanonicalAnswers,
  PackageRecommendation,
  RecommendationReason,
  RecommendationScoreBreakdown,
  MatchEngineResult,
  MatchLevel,
  SmartLeadSubmissionPayload,
  MatcherEntryPath,
} from "@/types/smart-match";

// ============================================================
// 1. ELIGIBLE PACKAGES FETCHER
// ============================================================

/**
 * Fetches all packages eligible for smart package matching from the database.
 * Eligibility Invariant:
 * - is_active === true (Active packages participate in recommendation)
 * - is_published === true (Unpublished packages are strictly excluded from public recommendations)
 * - recommendation_enabled !== false (if column exists)
 * - Uses PUBLIC_PACKAGE_SELECT to prevent leakage of internal cost/margin parameters.
 */
export async function fetchMatcherEligiblePackages(
  options?: { includeUnpublished?: boolean }
): Promise<PackageCatalogItem[]> {
  try {
    let query = (supabase as any)
      .from("package_catalog")
      .select(PUBLIC_PACKAGE_SELECT)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!options?.includeUnpublished) {
      query = query
        .eq("is_published", true)
        .eq("is_internal_only", false)
        .eq("approval_status", "approved");
    }

    const { data, error } = await query;

    if (error) {
      console.error("[fetchMatcherEligiblePackages] Supabase error:", error);
      return [];
    }

    // Filter strictly by active, published (unless bypassed for admin test), and recommendation enabled
    return (data || []).filter((p: any) => {
      const isActive = p.is_active === true;
      const isPublished = options?.includeUnpublished ? true : p.is_published === true;
      const isNotInternal = options?.includeUnpublished ? true : p.is_internal_only !== true;
      const isApproved = options?.includeUnpublished ? true : p.approval_status === "approved";
      const recEnabled = p.recommendation_enabled !== false;
      return isActive && isPublished && isNotInternal && isApproved && recEnabled;
    });
  } catch (err) {
    console.error("[fetchMatcherEligiblePackages] Unexpected error:", err);
    return [];
  }
}

/**
 * Fetches public packages for Direct Package Selection.
 * Invariant: is_active === true AND is_published === true AND is_internal_only === false AND approval_status === 'approved'.
 * Uses PUBLIC_PACKAGE_SELECT to prevent leakage of internal cost/margin parameters.
 */
export async function fetchDirectPublicPackages(): Promise<PackageCatalogItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("package_catalog")
      .select(PUBLIC_PACKAGE_SELECT)
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("is_internal_only", false)
      .eq("approval_status", "approved")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[fetchDirectPublicPackages] Supabase error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[fetchDirectPublicPackages] Unexpected error:", err);
    return [];
  }
}

// ============================================================
// 2. DETERMINISTIC SCORING ENGINE V2
// ============================================================

export { MATCHING_WEIGHTS } from "@/types/smart-match";

/**
 * Calculates score breakdown, reasons, and strategic gaps for a candidate package.
 * Scoring Dimensions V2:
 * 1. Primary Objective      30% (max 30)
 * 2. Requested Services     25% (max 25)
 * 3. Budget Compatibility   15% (max 15)
 * 4. Business Type Fit      10% (max 10)
 * 5. Business Stage Fit     10% (max 10)
 * 6. Growth Intensity        5% (max 5)
 * 7. Delivery Capacity       5% (max 5)
 * Total:                   100% (max 100)
 */
export function scorePackage(
  pkg: PackageCatalogItem,
  answers: CanonicalAnswers
): {
  score: number;
  breakdown: RecommendationScoreBreakdown;
  reasons: RecommendationReason[];
  gaps: string[];
  gapsAr: string[];
} {
  let objectiveScore = 0;    // max 30
  let servicesScore = 0;     // max 25
  let budgetScore = 0;       // max 15
  let businessTypeScore = 0; // max 10
  let stageScore = 0;        // max 10
  let growthLevelScore = 0;  // max 5
  let capacityScore = 5;     // max 5

  const reasons: RecommendationReason[] = [];
  const gaps: string[] = [];
  const gapsAr: string[] = [];

  const includedTexts = (pkg.included_items || []).map((i) => (i.text || "").toLowerCase());
  const pkgNameLower = (pkg.name || "").toLowerCase();
  const catLower = (pkg.category_name || "").toLowerCase();

  // Helper flags
  const hasReels = (pkg.monthly_reels || 0) > 0 || catLower.includes("production") || catLower.includes("reel");
  const hasPosts = (pkg.monthly_posts || 0) > 0;
  const hasStories = Boolean(pkg.monthly_stories && pkg.monthly_stories.trim()) || catLower.includes("stor");
  const hasAds = pkg.has_ads_management === true || catLower.includes("ad");
  const hasWeb = pkg.has_website === true || catLower.includes("web") || catLower.includes("digital");
  const hasStrat = pkg.has_strategy === true || catLower.includes("strateg");
  const hasCommunity = pkg.has_community_management === true;
  const hasProduction = (pkg.production_sessions || 0) > 0 || (pkg.production_hours || 0) > 0 || catLower.includes("production");

  // ----------------------------------------------------
  // A. PRIMARY OBJECTIVE (Weight: 30%)
  // ----------------------------------------------------
  const goals = answers.primaryGoals || [];
  if (goals.length === 0 || goals.includes("Not sure yet") || goals.includes("Not sure")) {
    objectiveScore = 24; // 80% baseline for strategic consultation
  } else {
    let goalMatches = 0;
    for (const g of goals) {
      const gl = g.toLowerCase();
      if (gl.includes("social") && (hasReels || hasPosts)) goalMatches++;
      else if (gl.includes("lead") && (hasAds || hasWeb || pkg.price >= 1000)) goalMatches++;
      else if (gl.includes("sale") && (hasAds || pkg.code === "WEB-03" || pkg.price >= 1090)) goalMatches++;
      else if (gl.includes("brand") && (hasStrat || hasProduction || pkg.price >= 1090)) goalMatches++;
      else if (gl.includes("ad") && hasAds) goalMatches++;
      else if (gl.includes("content") && (hasReels || hasPosts)) goalMatches++;
      else if (gl.includes("website") && hasWeb) goalMatches++;
      else if (gl.includes("online")) goalMatches++;
    }
    const goalRatio = Math.min(1, goalMatches / Math.max(1, goals.length));
    objectiveScore = Math.round(goalRatio * 30);

    if (goalRatio >= 0.5) {
      reasons.push({
        id: "goal_match",
        category: "general",
        text: `Directly aligned with your priority growth objectives.`,
        textAr: `تتوافق مباشرة مع أهداف نمو نشاطك التجاري.`,
      });
    }
  }

  // ----------------------------------------------------
  // B. REQUESTED SERVICES (Weight: 25%)
  // ----------------------------------------------------
  const required = answers.requiredServices || [];
  if (required.length === 0) {
    servicesScore = 18; // neutral baseline if unselected (e.g. in Quick Match)
  } else {
    let matchedCount = 0;
    const matchedServiceNames: string[] = [];

    for (const srv of required) {
      const s = srv.toLowerCase();
      let matched = false;

      if (s.includes("reel") || s.includes("video")) {
        if (hasReels) { matched = true; matchedServiceNames.push("Reels & Video"); }
      } else if (s.includes("post") || s.includes("carousel")) {
        if (hasPosts) { matched = true; matchedServiceNames.push("Posts & Carousels"); }
      } else if (s.includes("stori")) {
        if (hasStories) { matched = true; matchedServiceNames.push("Stories"); }
      } else if (s.includes("community")) {
        if (hasCommunity) { matched = true; matchedServiceNames.push("Community Management"); }
      } else if (s.includes("ad")) {
        if (hasAds) { matched = true; matchedServiceNames.push("Paid Advertising"); }
      } else if (s.includes("copywriting")) {
        if (includedTexts.some((t) => t.includes("copywriting")) || pkg.has_strategy) {
          matched = true;
          matchedServiceNames.push("Copywriting");
        }
      } else if (s.includes("content plan") || s.includes("planning")) {
        if (hasStrat || includedTexts.some((t) => t.includes("planning"))) {
          matched = true;
          matchedServiceNames.push("Content Planning");
        }
      } else if (s.includes("report")) {
        if (includedTexts.some((t) => t.includes("report"))) {
          matched = true;
          matchedServiceNames.push("Performance Reporting");
        }
      } else if (s.includes("website") || s.includes("seo")) {
        if (hasWeb) { matched = true; matchedServiceNames.push("Website & SEO"); }
      } else if (s.includes("booking") || s.includes("ordering")) {
        if (hasWeb && (pkg.code === "WEB-03" || pkg.name.toLowerCase().includes("system") || (pkg.website_scope && pkg.website_scope.toLowerCase().includes("booking")))) {
          matched = true;
          matchedServiceNames.push("Booking & Conversion System");
        }
      } else if (s.includes("strategy")) {
        if (hasStrat) { matched = true; matchedServiceNames.push("Marketing Strategy"); }
      } else if (s.includes("production") || s.includes("photograph")) {
        if (hasProduction) { matched = true; matchedServiceNames.push("Production Sessions"); }
      } else {
        matched = true; // generic match
      }

      if (matched) matchedCount++;
    }

    const matchRatio = matchedCount / required.length;
    servicesScore = Math.round(matchRatio * 25);

    if (matchedServiceNames.length > 0) {
      const topMatched = Array.from(new Set(matchedServiceNames)).slice(0, 3).join(", ");
      reasons.push({
        id: "service_match",
        category: "service",
        text: `Covers your requested services including ${topMatched}.`,
        textAr: `تغطي الخدمات المطلوبة بما فيها ${topMatched}.`,
      });
    }
  }

  // ----------------------------------------------------
  // C. BUDGET COMPATIBILITY (Weight: 15%)
  // ----------------------------------------------------
  const price = pkg.price || 0;
  if (!answers.budgetRange || answers.budgetRange === "not_sure") {
    budgetScore = 12;
  } else if (answers.budgetRange === "under_700") {
    if (price <= 700) {
      budgetScore = 15;
      reasons.push({
        id: "budget_match",
        category: "budget",
        text: `Comfortably fits within your entry budget at ${price} TND.`,
        textAr: `تناسب تماماً نطاق استثمارك الأولي بـ ${price} د.ت.`,
      });
    } else if (price <= 1100) {
      budgetScore = 7;
      gaps.push("Slightly above your sub-700 TND budget target, but provides significantly higher production deliverables.");
      gapsAr.push("أعلى قليلاً من ميزانية 700 د.ت ولكنها تمنحك طاقة إنتاجية ومخرجات أعلى بشكل ملحوظ.");
    } else {
      budgetScore = -20; // outside range
      gaps.push(`Investment (${price} TND) exceeds your sub-700 TND budget target, but is necessary to support your requested scope.`);
      gapsAr.push(`الاستثمار (${price} د.ت) يتجاوز ميزانية 700 د.ت الأولية، ولكنه ضروري لتغطية الخدمات المطلوبة.`);
    }
  } else if (answers.budgetRange === "700_1200") {
    if (price >= 690 && price <= 1300) {
      budgetScore = 15;
      reasons.push({
        id: "budget_match",
        category: "budget",
        text: `Optimized for your selected 700–1,200 TND investment range (${price} TND).`,
        textAr: `متوافقة تماماً مع ميزانيتك المحددة بين 700 و 1,200 د.ت (${price} د.ت).`,
      });
    } else if (price < 690) {
      budgetScore = 11;
    } else if (price <= 1800) {
      budgetScore = 5;
      gaps.push("Slightly above your 700–1,200 TND tier, but includes advanced advertising and strategic workflows.");
      gapsAr.push("أعلى قليلاً من نطاق 1,200 د.ت ولكنها تتضمن إدارة إعلانات ممولة ومسارات استراتيجية متطورة.");
    } else {
      budgetScore = -15;
      gaps.push(`Monthly investment (${price} TND) is above your 700–1,200 TND tier, but provides the dedicated team and capacity for your requested scope.`);
      gapsAr.push(`الاستثمار الشهري (${price} د.ت) يتجاوز نطاق 1,200 د.ت، ولكنه يوفر الفريق المتفرغ والطاقة اللازمة للمخرجات المطلوبة.`);
    }
  } else if (answers.budgetRange === "1200_2000") {
    if (price >= 1200 && price <= 2100) {
      budgetScore = 15;
      reasons.push({
        id: "budget_match",
        category: "budget",
        text: `Designed for your 1,200–2,000 TND growth investment level (${price} TND).`,
        textAr: `مصممة لنطاق استثمار النمو بين 1,200 و 2,000 د.ت (${price} د.ت).`,
      });
    } else if (price >= 900 && price < 1200) {
      budgetScore = 11;
    } else if (price > 2100 && price <= 2600) {
      budgetScore = 6;
      gaps.push("Near the upper edge of your budget, unlocking multi-platform execution.");
      gapsAr.push("تقترب من الحد الأعلى للميزانية وتمنحك تغطية منصات متعددة.");
    } else {
      budgetScore = 3;
      if (price > 2600) {
        gaps.push(`Investment (${price} TND) exceeds your 2,000 TND target, unlocking enterprise multi-platform dominance.`);
        gapsAr.push(`الاستثمار (${price} د.ت) يتجاوز ميزانية 2,000 د.ت، ويمنحك حضوراً تسويقياً متعدد القنوات رفيع المستوى.`);
      }
    }
  } else if (answers.budgetRange === "2000_plus") {
    if (price >= 2000) {
      budgetScore = 15;
      reasons.push({
        id: "budget_match",
        category: "budget",
        text: `Premium tier package unlocking enterprise deliverables and full creative team allocation.`,
        textAr: `باقة متكاملة توفر فريقاً إبداعياً كاملاً ومخرجات تسويقية متقدمة.`,
      });
    } else if (price >= 1400) {
      budgetScore = 9;
    } else {
      budgetScore = 3;
    }
  }

  // ----------------------------------------------------
  // D. BUSINESS TYPE MATCH (Weight: 10%)
  // ----------------------------------------------------
  const bType = answers.businessType ? answers.businessType.toLowerCase() : "";
  if (!bType || bType === "other") {
    businessTypeScore = 8;
  } else if (bType.includes("restaurant") || bType.includes("café") || bType.includes("food")) {
    if (hasProduction || (pkg.monthly_reels || 0) >= 6) {
      businessTypeScore = 10;
      reasons.push({
        id: "btype_food",
        category: "stage",
        text: `Includes dynamic visual reels and on-site production ideal for food & dining presentation.`,
        textAr: `تتضمن إنتاج فيديو وريلز حركية تناسب المطاعم والمقاهي.`,
      });
    } else {
      businessTypeScore = 6;
    }
  } else if (bType.includes("e-commerce")) {
    if (hasAds || hasWeb) {
      businessTypeScore = 10;
      reasons.push({
        id: "btype_ecom",
        category: "stage",
        text: `Structured for e-commerce conversion through paid ads and sales tracking.`,
        textAr: `مهيأة لتعظيم مبيعات التجارة الإلكترونية عبر الإعلانات وتحويل الزوار.`,
      });
    } else {
      businessTypeScore = 4;
    }
  } else if (bType.includes("real estate")) {
    if (hasProduction || hasAds) {
      businessTypeScore = 10;
      reasons.push({
        id: "btype_realestate",
        category: "stage",
        text: `Features high-definition property reels and lead acquisition workflows.`,
        textAr: `تتضمن ريلز عقارية بجودة سينمائية مع مسارات جذب واستقطاب المشترين.`,
      });
    } else {
      businessTypeScore = 6;
    }
  } else if (bType.includes("beauty") || bType.includes("cosmetics")) {
    if (hasProduction || (pkg.monthly_reels || 0) >= 6) {
      businessTypeScore = 10;
      reasons.push({
        id: "btype_beauty",
        category: "stage",
        text: `Calibrated for beauty lifestyle aesthetics, product visuals, and video reels.`,
        textAr: `مصممة خصيصاً للمنتجات الجمالية بتصوير عالي الجودة ومحتوى جذاب.`,
      });
    } else {
      businessTypeScore = 6;
    }
  } else if (bType.includes("travel") || bType.includes("tourism")) {
    if (hasProduction || (pkg.monthly_reels || 0) >= 6) {
      businessTypeScore = 10;
      reasons.push({
        id: "btype_travel",
        category: "stage",
        text: `Rich visual storytelling format optimized for travel and destination marketing.`,
        textAr: `سرد بصري جذاب ومحتوى سياحي متقن يجذب المسافرين والزوار.`,
      });
    } else {
      businessTypeScore = 6;
    }
  } else {
    businessTypeScore = 8;
  }

  // ----------------------------------------------------
  // E. BUSINESS STAGE MATCH (Weight: 10%)
  // ----------------------------------------------------
  const stage = answers.businessStage;
  if (!stage) {
    stageScore = 7;
  } else if (stage === "starting") {
    if (pkg.code === "MG-01" || pkg.code === "WEB-01" || pkg.price <= 750) {
      stageScore = 10;
      reasons.push({
        id: "stage_starting",
        category: "stage",
        text: `Ideal foundation for early-stage businesses to launch professionally without heavy overhead.`,
        textAr: `انطلاقة متينة للشركات الناشئة بدون أعباء مالية مبالغ فيها.`,
      });
    } else {
      stageScore = 4;
    }
  } else if (stage === "operating_growth") {
    if (pkg.code === "MG-02" || pkg.code === "HY-01" || (price >= 1000 && price <= 1600)) {
      stageScore = 10;
      reasons.push({
        id: "stage_growth",
        category: "stage",
        text: `Calibrated specifically for operating businesses scaling their client acquisition.`,
        textAr: `مصممة للشركات القائمة التي تسعى لزيادة تدفق العملاء والمبيعات.`,
      });
    } else {
      stageScore = 6;
    }
  } else if (stage === "growing_quickly" || stage === "established") {
    if (price >= 1700 || hasAds || pkg.code.startsWith("HY")) {
      stageScore = 10;
      reasons.push({
        id: "stage_scaling",
        category: "stage",
        text: `Provides the bandwidth, multi-platform presence, and advertising muscle required by established brands.`,
        textAr: `توفر الكثافة الإبداعية وتغطية المنصات التي تحتاجها العلامات التجارية الكبرى.`,
      });
    } else {
      stageScore = 4;
    }
  }

  // ----------------------------------------------------
  // F. GROWTH LEVEL / CONTENT INTENSITY (Weight: 5%)
  // ----------------------------------------------------
  const deliverables = (pkg.monthly_reels || 0) + (pkg.monthly_posts || 0);
  if (!answers.contentIntensity) {
    growthLevelScore = 3;
  } else if (answers.contentIntensity === "light") {
    if (deliverables >= 1 && deliverables <= 8) {
      growthLevelScore = 5;
      reasons.push({
        id: "content_light",
        category: "content",
        text: `Provides a focused, consistent presence (${pkg.monthly_reels || 4} Reels / ${pkg.monthly_posts || 4} Posts monthly) without overwhelming your team.`,
        textAr: `توفر حضوراً مركزاً ومستمراً (${pkg.monthly_reels || 4} ريلز و ${pkg.monthly_posts || 4} منشورات شهرياً).`,
      });
    } else if (deliverables === 0 && (hasWeb || hasAds)) {
      growthLevelScore = 4;
    } else {
      growthLevelScore = 2;
    }
  } else if (answers.contentIntensity === "active") {
    if (deliverables >= 12 && deliverables <= 18) {
      growthLevelScore = 5;
      reasons.push({
        id: "content_active",
        category: "content",
        text: `Delivers steady, high-impact monthly content cadence (${pkg.monthly_reels} Reels + ${pkg.monthly_posts} Posts).`,
        textAr: `تضمن وتيرة محتوى منتظمة وفعالة (${pkg.monthly_reels} ريلز و ${pkg.monthly_posts} منشورات شهرياً).`,
      });
    } else if (deliverables >= 8 && deliverables < 12) {
      growthLevelScore = 4;
    } else {
      growthLevelScore = 2;
    }
  } else if (answers.contentIntensity === "high_growth") {
    if (deliverables >= 16 || hasProduction) {
      growthLevelScore = 5;
      reasons.push({
        id: "content_high_growth",
        category: "content",
        text: `Built for aggressive market expansion with high-frequency content and on-site production capability.`,
        textAr: `مصممة للنمو السريع بنشر مكثف وجلسات تصوير ميدانية مخصصة.`,
      });
    } else if (deliverables >= 12) {
      growthLevelScore = 3;
    } else {
      growthLevelScore = 1;
    }
  }

  // ----------------------------------------------------
  // G. DELIVERY CAPACITY & SYSTEM REQUIREMENTS (Weight: 5% + Hard Constraints)
  // ----------------------------------------------------
  let penalty = 0;

  // Advertising Hard Constraint Check
  if (answers.advertisingNeed === "every_month") {
    if (hasAds) {
      reasons.push({
        id: "ads_dedicated",
        category: "advertising",
        text: `Includes structured Meta Ads campaign creation, optimization, and conversion tracking.`,
        textAr: `تشمل إدارة وتحسين الحملات الإعلانية الممولة على ميتا مع تتبع التحويلات.`,
      });
    } else {
      penalty -= 25; // Cannot win if client specifically needs monthly ads
      gaps.push("Does not include monthly paid advertising management.");
      gapsAr.push("لا تتضمن إدارة الحملات الإعلانية الممولة الشهرية.");
    }
  }

  // Website / Booking Hard Constraint Check
  if (answers.websiteNeed === "website") {
    if (hasWeb) {
      reasons.push({
        id: "website_included",
        category: "website",
        text: `Covers professional web design and digital infrastructure.`,
        textAr: `تتضمن تصميم وبرمجة موقع احترافي وبنية رقمية متطورة.`,
      });
    } else {
      penalty -= 25;
      gaps.push("Does not include website design or web infrastructure.");
      gapsAr.push("لا تتضمن تصميم أو برمجة موقع إلكتروني.");
    }
  } else if (answers.websiteNeed === "booking_system") {
    const isBookingCapable =
      hasWeb &&
      (pkg.code === "WEB-03" ||
        pkg.name.toLowerCase().includes("system") ||
        (pkg.website_scope && pkg.website_scope.toLowerCase().includes("booking")) ||
        pkg.price >= 2400);

    if (isBookingCapable) {
      reasons.push({
        id: "booking_system_included",
        category: "website",
        text: `Equipped with custom online booking, ordering, or conversion workflow features.`,
        textAr: `مجهزة بنظام حجز وتجارة إلكترونية متكامل لتحويل الزوار إلى عملاء.`,
      });
    } else if (hasWeb) {
      capacityScore = 2;
      penalty -= 10;
      gaps.push("Standard website scope without advanced custom booking/ordering workflows.");
      gapsAr.push("موقع قياسي بدون أنظمة الحجز والتجارة المتقدمة.");
    } else {
      penalty -= 30; // Decisive hard penalty
      gaps.push("Does not include online booking or automated conversion system.");
      gapsAr.push("لا تتضمن نظام حجز إلكتروني أو مسار تحويل آلي.");
    }
  }

  // Volume Capacity Check
  if (answers.contentIntensity === "high_growth" && (pkg.monthly_reels || 0) < 8 && !hasProduction) {
    capacityScore = 2;
    gaps.push("Your requested high-growth output may require additional modular video sessions.");
    gapsAr.push("قد تتطلب تطلعات النمو السريع جلسات تصوير فيديو إضافية.");
  }

  const rawTotal =
    objectiveScore +
    servicesScore +
    budgetScore +
    businessTypeScore +
    stageScore +
    growthLevelScore +
    capacityScore +
    penalty;

  const totalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

  const uniqueReasons = reasons.filter(
    (r, idx, self) => idx === self.findIndex((item) => item.id === r.id)
  ).slice(0, 5);

  return {
    score: totalScore,
    breakdown: {
      objective: Math.max(0, objectiveScore),
      services: Math.max(0, servicesScore),
      budget: Math.max(0, budgetScore),
      businessType: Math.max(0, businessTypeScore),
      stage: Math.max(0, stageScore),
      growthLevel: Math.max(0, growthLevelScore),
      capacity: Math.max(0, capacityScore),
      totalScore,
      // Legacy compatibility mappings
      serviceMatch: Math.max(0, servicesScore),
      goalMatch: Math.max(0, Math.round((objectiveScore / 30) * 20)),
      contentMatch: Math.max(0, Math.round((growthLevelScore / 5) * 15)),
      advertisingMatch: hasAds ? 10 : 0,
      websiteMatch: hasWeb ? 10 : 0,
      budgetMatch: Math.max(0, Math.round((budgetScore / 15) * 10)),
      businessTypeMatch: Math.max(0, Math.round((businessTypeScore / 10) * 5)),
      businessStageMatch: Math.max(0, Math.round((stageScore / 10) * 5)),
    },
    reasons: uniqueReasons,
    gaps,
    gapsAr,
  };
}

/**
 * Calculates the match level badge from numeric score
 */
export function getMatchLevel(score: number): MatchLevel {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "moderate";
  return "custom_fit";
}

// ============================================================
// 3. RECOMMENDATION ENGINE ENTRY POINT V2
// ============================================================

/**
 * Runs the deterministic package recommendation algorithm against candidate packages.
 * - Filters strictly by is_active === true
 * - Ranks packages by V2 compatibility score
 * - Selects best fit + max 2 intelligently annotated alternatives
 * - Assigns comparison reasons (budget_friendly vs expanded_scope)
 * - Detects active unpublished winners to show bespoke team solution
 * - Provides graceful fallback when score < threshold or catalog empty
 */
export function runPackageRecommendationEngine(
  packages: PackageCatalogItem[],
  answers: CanonicalAnswers
): MatchEngineResult {
  // Hard Constraint: package must be active, published, approved, and non-internal
  const eligible = (packages || []).filter((p) => {
    const isActive = p.is_active === true;
    const isPublished = (answers as any)?.includeUnpublished ? true : p.is_published === true;
    const isNotInternal = (answers as any)?.includeUnpublished ? true : p.is_internal_only !== true;
    const isApproved = (answers as any)?.includeUnpublished ? true : p.approval_status === "approved";
    const recEnabled = (p as any).recommendation_enabled !== false;
    return isActive && isPublished && isNotInternal && isApproved && recEnabled;
  });

  if (eligible.length === 0) {
    return {
      bestFit: null,
      alternatives: [],
      status: "no_match",
      fallbackMessage:
        "We couldn’t find a standard package that fully matches your requirements, but our team can help create the right solution.",
      fallbackMessageAr:
        "لم نجد باقة قياسية تطابق متطلباتك بدقة، ولكن فريقنا الاستراتيجي سيبني لك حلاً مخصصاً بالكامل.",
    };
  }

  // Score all eligible packages
  const scoredList: PackageRecommendation[] = eligible.map((pkg) => {
    const { score, breakdown, reasons, gaps, gapsAr } = scorePackage(pkg, answers);
    return {
      packageId: pkg.id,
      packageCode: pkg.code,
      packageName: pkg.name,
      packageNameAr: pkg.name_ar,
      packagePrice: pkg.price,
      currency: pkg.currency || "TND",
      billingType: pkg.billing_type || "monthly",
      score,
      matchLevel: getMatchLevel(score),
      breakdown,
      reasons,
      gaps,
      gapsAr,
      isUnpublished: pkg.is_published === false,
      packageItem: pkg,
    };
  });

  // Sort descending by score, tiebreak by display_order ASC
  scoredList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.packageItem.display_order || 99) - (b.packageItem.display_order || 99);
  });

  const bestCandidate = scoredList[0];

  // If even the best score is very low (< 40), trigger graceful fallback
  if (!bestCandidate || bestCandidate.score < 40) {
    return {
      bestFit: null,
      alternatives: scoredList.slice(0, 2),
      status: "no_match",
      fallbackMessage:
        "We couldn’t find a standard package that fully matches your requirements, but our team can help create the right solution.",
      fallbackMessageAr:
        "لم نجد باقة قياسية تطابق متطلباتك بدقة، ولكن فريقنا الاستراتيجي سيبني لك حلاً مخصصاً بالكامل.",
    };
  }

  // Select up to 2 alternatives with comparison metadata
  const remaining = scoredList.slice(1).filter((r) => r.packageId !== bestCandidate.packageId);
  const lighterOption = remaining.find((r) => r.packagePrice < bestCandidate.packagePrice);
  const broaderOption = remaining.find((r) => r.packagePrice > bestCandidate.packagePrice);

  const alternatives: PackageRecommendation[] = [];
  if (lighterOption) {
    lighterOption.alternativeType = "budget_friendly";
    lighterOption.comparisonReason = "Lower monthly investment, ideal for focused organic content.";
    lighterOption.comparisonReasonAr = "استثمار شهري أقل، مثالية للتركيز على المحتوى الأولي.";
    alternatives.push(lighterOption);
  }
  if (broaderOption && alternatives.length < 2) {
    broaderOption.alternativeType = "expanded_scope";
    broaderOption.comparisonReason = "Broader execution capacity with expanded deliverables and higher production bandwidth.";
    broaderOption.comparisonReasonAr = "طاقة إنتاجية أوسع تتضمن مخرجات إضافية وميزات تسويقية متقدمة.";
    alternatives.push(broaderOption);
  }

  // If we don't have 2 yet, fill with top remaining
  for (const alt of remaining) {
    if (alternatives.length >= 2) break;
    if (!alternatives.some((a) => a.packageId === alt.packageId)) {
      alt.alternativeType = "also_consider";
      alt.comparisonReason = "A strong strategic alternative matching your industry requirements.";
      alt.comparisonReasonAr = "خيار استراتيجي ممتاز يتناسب مع طبيعة نشاطك التجاري.";
      alternatives.push(alt);
    }
  }

  return {
    bestFit: bestCandidate,
    alternatives,
    status: "success",
    debugTrace: {
      evaluatedPackagesCount: eligible.length,
      topCandidates: scoredList.slice(0, 5).map((p) => ({
        code: p.packageCode,
        name: p.packageName,
        score: p.score,
      })),
    },
  };
}

// ============================================================
// 4. SERVER-SIDE SECURE SUBMISSION & LEAD CREATION
// ============================================================

/**
 * Server-side / Service-side verification and lead capture.
 * Follows Section 19:
 * - Never trust the browser to decide the recommendation.
 * - Reloads eligible packages from DB.
 * - Recalculates recommendation score server-side.
 * - Verifies active and recommendation_enabled.
 * - Stores lead in contact_submissions with qualification answers + recommendation context.
 * - Seamlessly integrates with Sales Pipeline (deals table) when available.
 */
export async function submitSmartContactLead(
  payload: SmartLeadSubmissionPayload
): Promise<{ success: boolean; leadId?: string; dealId?: string; error?: string }> {
  try {
    const { lead, qualification, source } = payload;

    // 1. Re-verify recommendation from DB source of truth
    const eligiblePackages = await fetchMatcherEligiblePackages();
    let verifiedRec = payload.recommendation;

    if (source === "smart_match" || source === "quick_match") {
      const serverResult = runPackageRecommendationEngine(eligiblePackages, qualification);
      if (serverResult.bestFit) {
        verifiedRec = {
          packageId: serverResult.bestFit.packageId,
          packageCode: serverResult.bestFit.packageCode,
          packageName: serverResult.bestFit.packageName,
          score: serverResult.bestFit.score,
          matchLevel: serverResult.bestFit.matchLevel,
          alternativePackageIds: serverResult.alternatives.map((a) => a.packageId),
          reasons: serverResult.bestFit.reasons.map((r) => r.text),
          isUnpublished: serverResult.bestFit.isUnpublished,
        };
      }
    } else if (source === "direct_package" && payload.recommendation?.packageId) {
      // Verify direct package exists and is active & published
      const targetPkg = eligiblePackages.find((p) => p.id === payload.recommendation?.packageId);
      if (targetPkg && targetPkg.is_active === true && targetPkg.is_published !== false) {
        verifiedRec = {
          packageId: targetPkg.id,
          packageCode: targetPkg.code,
          packageName: targetPkg.name,
          score: 100,
          matchLevel: "strong",
          alternativePackageIds: [],
          reasons: ["Direct package selection by client."],
          isUnpublished: false,
        };
      } else {
        return {
          success: false,
          error: "The selected package is no longer available or published.",
        };
      }
    }

    // 2. Format request summary and primary service
    const primaryService =
      verifiedRec?.packageName ||
      qualification.requiredServices?.[0] ||
      qualification.primaryGoals?.[0] ||
      "SADA Consultation";

    const budgetText = qualification.budgetRange
      ? qualification.budgetRange.replace("_", " ").toUpperCase()
      : null;

    // Format human-readable message block
    const summaryLines = [
      `[SADA Smart Match Inquiry — ${source.toUpperCase()}]`,
      `Client: ${lead.fullName} (${lead.businessName})`,
      `Email: ${lead.email} | Phone: ${lead.phone || "N/A"}${lead.city ? ` | City: ${lead.city}` : ""}`,
      verifiedRec
        ? `Recommended Package: ${verifiedRec.packageName} (${verifiedRec.score}% match - ${verifiedRec.matchLevel})`
        : `Target: Custom Consultation`,
      qualification.businessType ? `Business: ${qualification.businessType}` : null,
      qualification.primaryGoals.length > 0 ? `Goals: ${qualification.primaryGoals.join(", ")}` : null,
      qualification.requiredServices.length > 0 ? `Services: ${qualification.requiredServices.join(", ")}` : null,
      qualification.contentIntensity ? `Content Intensity: ${qualification.contentIntensity}` : null,
      qualification.advertisingNeed ? `Advertising Need: ${qualification.advertisingNeed}` : null,
      qualification.websiteNeed ? `Website Need: ${qualification.websiteNeed}` : null,
      lead.additionalMessage ? `\nClient Note:\n"${lead.additionalMessage}"` : null,
      qualification.additionalContext ? `\nAdditional Context:\n"${qualification.additionalContext}"` : null,
    ].filter(Boolean);

    const fullMessage = summaryLines.join("\n");

    // 3. Prepare structured discovery_data JSONB
    const discoveryPayload = {
      lead,
      qualification,
      recommendation: verifiedRec,
      source,
      submitted_at: new Date().toISOString(),
    };

    // 4. Map DB path_taken to satisfy RLS check constraint ('guided' | 'quick' | 'free_text')
    let dbPathTaken: "guided" | "quick" | "free_text" = "guided";
    if (source === "quick_match") dbPathTaken = "quick";
    else if (source === "direct_package") dbPathTaken = "guided";
    else dbPathTaken = "guided";

    // 5. Insert into contact_submissions with pre-generated UUID (bypasses anon select restriction)
    const leadId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined;
    const insertData: any = {
      ...(leadId ? { id: leadId } : {}),
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone || null,
      business_name: lead.businessName || null,
      service: primaryService.slice(0, 80),
      budget: budgetText ? budgetText.slice(0, 40) : null,
      message: fullMessage,
      status: "new",
      preferred_contact: "WhatsApp",
      path_taken: dbPathTaken,
      discovery_data: discoveryPayload,
      questionnaire_answers: discoveryPayload,
    };

    const { error: leadError } = await (supabase as any)
      .from("contact_submissions")
      .insert(insertData);

    if (leadError) {
      console.error("[submitSmartContactLead] contact_submissions error:", leadError);
      return { success: false, error: leadError.message };
    }

    // 6. Section 18: Sales Pipeline Integration (Optional deal creation in deals table)
    let dealId: string | undefined;
    try {
      const dealInsert = {
        title: `${lead.businessName || lead.fullName} — ${verifiedRec?.packageName || "Project Inquiry"}`,
        contact_name: lead.fullName,
        contact_email: lead.email,
        contact_phone: lead.phone || null,
        company_name: lead.businessName || lead.fullName,
        stage: "lead",
        deal_value: 0,
        service_revenue: 0,
        notes: fullMessage,
      };

      const { data: dealRes } = await (supabase as any)
        .from("deals")
        .insert(dealInsert)
        .select("id")
        .maybeSingle();

      if (dealRes?.id) {
        dealId = dealRes.id;
      }
    } catch {
      // deals table might be protected or absent, non-fatal for client lead
    }

    return {
      success: true,
      leadId,
      dealId,
    };
  } catch (err: any) {
    console.error("[submitSmartContactLead] Unexpected error:", err);
    return { success: false, error: err.message || "Failed to submit lead" };
  }
}
