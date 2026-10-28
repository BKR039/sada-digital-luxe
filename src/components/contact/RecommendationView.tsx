// ============================================================
// SADA OS — SMART MATCHER: RECOMMENDATION RESULT VIEW (V2)
// Weighted multi-dimensional best fit, gap transparency, intelligent alternatives & FCC typography
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Layers,
  Zap,
  Check,
  Building,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SADAButton, SADABadge, SADACard } from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { useTranslation } from "@/i18n";
import type {
  MatchEngineResult,
  PackageRecommendation,
} from "@/types/smart-match";
import { MATCHING_WEIGHTS } from "@/types/smart-match";

interface RecommendationViewProps {
  engineResult: MatchEngineResult;
  onProceedToContact: (selectedPackage: PackageRecommendation | null) => void;
  onRetake: () => void;
}

export function RecommendationView({
  engineResult,
  onProceedToContact,
  onRetake,
}: RecommendationViewProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const { bestFit: initialBestFit, alternatives, status, fallbackMessage, fallbackMessageAr, debugTrace } = engineResult;
  const [activeSelection, setActiveSelection] = useState<PackageRecommendation | null>(initialBestFit);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // If no match was found, render fallback
  if (status === "no_match" || !activeSelection) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto space-y-6 text-center"
      >
        <SADACard className="p-8 sm:p-10 border-border space-y-6">
          <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center mx-auto border border-amber-500/20">
            <Sparkles className="size-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
              {isAr ? "فلنتحدث عما يحتاجه مشروعك بدقة" : "Let’s talk about what you need"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {isAr
                ? (fallbackMessageAr || "لم نجد باقة قياسية تطابق متطلباتك بدقة، ولكن فريقنا الاستراتيجي سيبني لك حلاً مخصصاً بالكامل.")
                : (fallbackMessage || "We couldn’t find a standard package that fully matches your requirements, but our team can help create the right solution.")}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
            {isAr
              ? "متطلباتك فريدة وتستحق دراسة استراتيجية خاصة. يمكنك إرسال إجاباتك وسنتواصل معك لاقتراح هيكل عمل مخصص."
              : "Your business requirements are unique. Submit your brief below and our senior team will craft a tailored execution roadmap."}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-border">
            <SADAButton variant="outline" onClick={onRetake} className="w-full sm:w-auto gap-2 min-h-[44px] px-5 whitespace-nowrap shrink-0">
              <ArrowLeft className="size-4 rtl:rotate-180 shrink-0" />
              <span className="whitespace-nowrap">{isAr ? "تعديل الإجابات" : "Adjust Answers"}</span>
            </SADAButton>

            <SADAButton
              variant="primary"
              onClick={() => onProceedToContact(null)}
              className="w-full sm:w-auto gap-2 font-semibold min-h-[44px] px-6 whitespace-nowrap shrink-0"
            >
              <span className="whitespace-nowrap">{isAr ? "متابعة لتفاصيل التواصل" : "Continue to Contact Details"}</span>
              <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
            </SADAButton>
          </div>
        </SADACard>
      </motion.div>
    );
  }

  const pkg = activeSelection;
  const isUnpublished = pkg.isUnpublished;
  const gaps = isAr ? (pkg.gapsAr || pkg.gaps || []) : (pkg.gaps || []);
  const breakdown = pkg.breakdown;

  // Match quality tier label
  const matchQualityLabel =
    pkg.score >= 90
      ? (isAr ? "توافق استثنائي" : "Excellent Fit")
      : pkg.score >= 80
      ? (isAr ? "توافق قوي جداً" : "Strong Fit")
      : pkg.score >= 70
      ? (isAr ? "توافق متوازن" : "Good Fit")
      : (isAr ? "حل بديل ملائم" : "Compatible Fit");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* 18. TOP SECTION HIERARCHY */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono tracking-widest uppercase">
          <Sparkles className="size-3.5" />
          {isAr ? "وجدنا الحل الأنسب لك" : "WE FOUND YOUR BEST FIT"}
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-foreground">
            {isAr ? (pkg.packageNameAr || pkg.packageName) : pkg.packageName}
          </h1>

          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-0.5 rounded-full">
              <SADANumber variant="percent" value={pkg.score} /> {isAr ? "توافق مدروس" : "MATCH"}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-0.5 rounded-full">
              {matchQualityLabel}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {isAr
            ? "بناءً على أهدافك الاستراتيجية، الخدمات المطلوبة، ميزانيتك، ومرحلة نشاطك التجاري، هذه الباقة تمثل الحل الأقوى والأعلى عائداً لاحتياجاتك الحالية."
            : "Based on your objectives, requested services, budget and business stage, this is the strongest fit for your current needs."}
        </p>
      </div>

      {/* 19. MAIN RECOMMENDED PACKAGE CARD */}
      <SADACard className="relative overflow-hidden border-2 border-primary/40 bg-card p-6 sm:p-9 shadow-2xl space-y-7 backdrop-blur-sm">
        {/* Ambient Radial Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Tailored Solution Banner if winner is unpublished */}
        {isUnpublished && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono">
              <Sparkles className="size-4" />
              {isAr ? "حل مخصص غير متاح في الكتالوج العام" : "Bespoke Team Solution"}
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed">
              {isAr
                ? "وجدنا حلاً مصمماً خصيصاً لاحتياجاتك. هذا الحل متاح حصرياً عبر مستشارينا وليس جزءاً من كتالوج الباقات العام."
                : "We found a tailored solution for your needs. This solution is currently available through our team and isn't part of our public package catalog."}
            </p>
          </div>
        )}

        {/* Package Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-bold text-muted-foreground uppercase px-2.5 py-1 rounded-md bg-muted">
                {pkg.packageCode}
              </span>
              <span className="text-xs font-bold text-primary font-mono tracking-wider uppercase">
                {isAr ? "الباقة الأساسية المعتمدة" : "CANONICAL SELECTION"}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              {isAr
                ? (pkg.packageItem.short_description_ar || pkg.packageItem.short_description)
                : (pkg.packageItem.short_description || pkg.packageItem.description)}
            </p>
          </div>

          {/* Pricing via Financial Command Center Typography */}
          <div className="text-left sm:text-right shrink-0">
            {pkg.packagePrice > 0 ? (
              <div>
                <SADANumber
                  variant="kpi"
                  value={pkg.packagePrice}
                  currency={pkg.currency || "TND"}
                  className="text-3xl sm:text-4xl text-foreground font-bold tracking-tight"
                />
                <span className="text-xs text-muted-foreground ms-1.5 block sm:inline font-sans">
                  / {pkg.billingType === "monthly" ? (isAr ? "شهرياً" : "month") : (isAr ? "مرة واحدة" : "one-time")}
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold font-display text-primary">
                {isAr ? "تسعير مخصص" : "Custom Quote"}
              </span>
            )}
          </div>
        </div>

        {/* 13. "Why this package?" Factual Strategic Reasons */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary font-mono">
            <CheckCircle2 className="size-4" />
            {isAr ? "لماذا تعتبر هذه الباقة الأنسب لك؟" : "Why this package is your best fit"}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pkg.reasons.map((r, i) => (
              <div
                key={r.id || i}
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs transition-colors hover:border-primary/30"
              >
                <div className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                  <Check className="size-3 stroke-[3]" />
                </div>
                <span className="text-foreground/90 font-medium leading-relaxed">
                  {isAr ? r.textAr : r.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 19. Included Deliverables Preview (Chips & Rows) */}
        {pkg.packageItem.included_items && pkg.packageItem.included_items.length > 0 && (
          <div className="space-y-2.5 pt-4 border-t border-border/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-mono">
              <Layers className="size-3.5 text-primary" />
              {isAr ? "نطاق الخدمات والمخرجات المشمولة:" : "Included Deliverables & Monthly Scope:"}
            </div>

            <div className="flex flex-wrap gap-2">
              {pkg.packageItem.included_items.slice(0, 8).map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  {isAr ? (item.text_ar || item.text) : item.text}
                </span>
              ))}
              {pkg.packageItem.included_items.length > 8 && (
                <span className="px-3 py-1.5 text-xs text-muted-foreground font-mono font-medium rounded-xl bg-muted/40 border border-border">
                  +{pkg.packageItem.included_items.length - 8} {isAr ? "ميزات إضافية" : "more deliverables"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 14. "One consideration" (Strategic Gap Explanation) */}
        {gaps.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] space-y-2 text-start">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
              <AlertTriangle className="size-4 shrink-0" />
              {isAr ? "نقطة للمراعاة والشفافية الاستراتيجية" : "One Consideration"}
            </div>
            <ul className="space-y-1.5 text-xs text-foreground/80 leading-relaxed list-disc list-inside">
              {gaps.map((gap, i) => (
                <li key={i} className="leading-relaxed">
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 27. DEBUG / TEST MODE BREAKDOWN */}
        <div className="pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowDebug((prev) => !prev)}
            className="flex items-center justify-between w-full text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <Cpu className="size-3.5" />
              {isAr ? "تدقيق درجات المطابقة (Score Breakdown)" : "Inspect Match Score Breakdown"}
            </span>
            {showDebug ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          <AnimatePresence>
            {showDebug && breakdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 overflow-hidden text-xs"
              >
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 font-mono">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-border/80">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Objective (30%)</span>
                      <span className="font-bold text-foreground">{breakdown.objective}/30</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Services (25%)</span>
                      <span className="font-bold text-foreground">{breakdown.services}/25</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Budget (15%)</span>
                      <span className="font-bold text-foreground">{breakdown.budget}/15</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Business Type (10%)</span>
                      <span className="font-bold text-foreground">{breakdown.businessType}/10</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Stage (10%)</span>
                      <span className="font-bold text-foreground">{breakdown.stage}/10</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Growth (5%)</span>
                      <span className="font-bold text-foreground">{breakdown.growthLevel}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Capacity (5%)</span>
                      <span className="font-bold text-foreground">{breakdown.capacity}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Total Score</span>
                      <span className="font-bold text-primary">{breakdown.totalScore}/100 ({pkg.score}%)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button Row */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
          <SADAButton
            variant="outline"
            onClick={onRetake}
            className="w-full sm:w-auto gap-2 min-h-[44px] px-5 text-xs sm:text-sm whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="size-4 rtl:rotate-180 shrink-0" />
            <span className="whitespace-nowrap">{isAr ? "رجوع لتعديل الإجابات" : "Back"}</span>
          </SADAButton>

          <SADAButton
            variant="primary"
            onClick={() => onProceedToContact(pkg)}
            className="w-full sm:w-auto gap-2 font-bold text-xs sm:text-sm px-7 py-3 min-h-[44px] shadow-lg whitespace-nowrap shrink-0"
          >
            <span className="whitespace-nowrap">{isAr ? "اعتماد الباقة والمتابعة للتواصل" : "Proceed with this Package"}</span>
            <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
          </SADAButton>
        </div>
      </SADACard>

      {/* 15. INTELLIGENT ALTERNATIVE PACKAGES */}
      {alternatives && alternatives.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold font-display text-foreground">
              {isAr ? "خيارات بديلة تستحق الدراسة" : "Intelligently Ranked Alternatives"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "بناءً على تدرج الميزانية وحجم المخرجات، قمنا بحساب هذين الخيارين كبديلين استراتيجيين."
                : "Calculated alternatives based on budget elasticity and production deliverable volume."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {alternatives.map((alt) => {
              const isSelected = activeSelection.packageId === alt.packageId;
              const isBudgetFriendly = alt.alternativeType === "budget_friendly" || alt.packagePrice < (initialBestFit?.packagePrice || 0);
              const altReason = isAr
                ? (alt.comparisonReasonAr || alt.reasons[0]?.textAr || "")
                : (alt.comparisonReason || alt.reasons[0]?.text || "");

              return (
                <div
                  key={alt.packageId}
                  onClick={() => setActiveSelection(alt)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all text-start flex flex-col justify-between gap-4 group ${
                    isSelected
                      ? "border-primary bg-primary/[0.07] shadow-lg ring-1 ring-primary/50"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5 bg-muted text-muted-foreground">
                        {isBudgetFriendly ? (
                          <>
                            <TrendingDown className="size-3 text-emerald-500" />
                            {isAr ? "خيار اقتصادي" : "Budget-Friendly"}
                          </>
                        ) : (
                          <>
                            <TrendingUp className="size-3 text-primary" />
                            {isAr ? "نطاق نمو أوسع" : "Expanded Scope"}
                          </>
                        )}
                      </span>

                      <SADABadge variant="outline" className="text-xs font-mono">
                        <SADANumber variant="percent" value={alt.score} /> {isAr ? "توافق" : "Match"}
                      </SADABadge>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground text-base sm:text-lg font-display">
                        {isAr ? (alt.packageNameAr || alt.packageName) : alt.packageName}
                      </h4>
                      <div className="mt-1">
                        {alt.packagePrice > 0 ? (
                          <div className="flex items-baseline gap-1">
                            <SADANumber
                              variant="metric"
                              value={alt.packagePrice}
                              currency={alt.currency || "TND"}
                              className="text-base font-bold text-foreground"
                            />
                            <span className="text-xs text-muted-foreground font-sans">
                              / {alt.billingType === "monthly" ? (isAr ? "شهرياً" : "mo") : (isAr ? "مرة واحدة" : "one-time")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-primary">
                            {isAr ? "تسعير مخصص" : "Custom Quote"}
                          </span>
                        )}
                      </div>
                    </div>

                    {altReason && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {altReason}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-semibold whitespace-nowrap">
                    <span className="text-primary group-hover:underline shrink-0">
                      {isSelected
                        ? (isAr ? "✓ محدد كباقة معتمدة" : "✓ Selected Best Fit")
                        : (isAr ? "اختيار هذه الباقة البديلة" : "Select this alternative")}
                    </span>
                    <ArrowRight className="size-3.5 text-primary shrink-0 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
