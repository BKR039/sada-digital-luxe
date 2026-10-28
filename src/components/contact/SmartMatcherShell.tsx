// ============================================================
// SADA OS — SMART PACKAGE MATCHER SHELL (MASTER COORDINATOR)
// Unified 3-Path Entry, Canonical Engine Orchestration & Intake
// ============================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Compass,
  Layers,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { SADAButton, SADABadge, SADACard } from "@/components/ui/sada-ui";
import { SmartMatchLongForm } from "./SmartMatchLongForm";
import { QuickMatchForm } from "./QuickMatchForm";
import { DirectPackageSelector } from "./DirectPackageSelector";
import { RecommendationView } from "./RecommendationView";
import { ContactDetailsForm } from "./ContactDetailsForm";
import { SmartMatchSuccessView } from "./SmartMatchSuccessView";
import {
  fetchMatcherEligiblePackages,
  runPackageRecommendationEngine,
  submitSmartContactLead,
} from "@/lib/smart-match-service";
import type { PackageCatalogItem } from "@/types/package-catalog";
import type {
  CanonicalAnswers,
  ContactDetails,
  MatchEngineResult,
  MatcherEntryPath,
  PackageRecommendation,
} from "@/types/smart-match";
import { INITIAL_CANONICAL_ANSWERS } from "@/types/smart-match";

interface SmartMatcherShellProps {
  initialPackageParam?: string;
}

type Stage =
  | "selection"
  | "smart_form"
  | "quick_form"
  | "direct_catalog"
  | "recommendation"
  | "contact_form"
  | "success";

export function SmartMatcherShell({ initialPackageParam }: SmartMatcherShellProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  // Flow State
  const [stage, setStage] = useState<Stage>(
    initialPackageParam ? "direct_catalog" : "selection"
  );
  const [activePath, setActivePath] = useState<MatcherEntryPath>(
    initialPackageParam ? "direct_package" : "smart_match"
  );

  // Loaded packages & engine state
  const [packages, setPackages] = useState<PackageCatalogItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(true);

  // User Answers
  const [canonicalAnswers, setCanonicalAnswers] = useState<CanonicalAnswers>({
    ...INITIAL_CANONICAL_ANSWERS,
  });

  // Recommendation & Selection
  const [engineResult, setEngineResult] = useState<MatchEngineResult | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageRecommendation | null>(null);

  // Final submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedLead, setSubmittedLead] = useState<{
    lead: ContactDetails;
    packageRec: PackageRecommendation | null;
  } | null>(null);

  // Load packages on mount
  useEffect(() => {
    async function load() {
      setLoadingPackages(true);
      const data = await fetchMatcherEligiblePackages();
      setPackages(data);
      setLoadingPackages(false);
    }
    load();
  }, []);

  // When long form finishes
  const handleSmartFormComplete = (answers: CanonicalAnswers) => {
    setCanonicalAnswers(answers);
    const result = runPackageRecommendationEngine(packages, answers);
    setEngineResult(result);
    setSelectedPackage(result.bestFit);
    setStage("recommendation");
  };

  // When quick form finishes
  const handleQuickFormComplete = (answers: CanonicalAnswers) => {
    setCanonicalAnswers(answers);
    const result = runPackageRecommendationEngine(packages, answers);
    setEngineResult(result);
    setSelectedPackage(result.bestFit);
    setStage("recommendation");
  };

  // When user directly selects a package
  const handleDirectPackageSelect = (rec: PackageRecommendation) => {
    setSelectedPackage(rec);
    setStage("contact_form");
  };

  // When recommendation is approved -> move to contact capture
  const handleRecommendationProceed = (chosen: PackageRecommendation | null) => {
    setSelectedPackage(chosen);
    setStage("contact_form");
  };

  // Final submission handler
  const handleFinalSubmit = async (contactInfo: ContactDetails) => {
    setIsSubmitting(true);
    try {
      const payload = {
        lead: contactInfo,
        qualification: canonicalAnswers,
        recommendation: selectedPackage
          ? {
              packageId: selectedPackage.packageId,
              packageCode: selectedPackage.packageCode,
              packageName: selectedPackage.packageName,
              score: selectedPackage.score,
              matchLevel: selectedPackage.matchLevel,
              alternativePackageIds: (engineResult?.alternatives || []).map((a) => a.packageId),
              reasons: selectedPackage.reasons.map((r) => r.text),
              isUnpublished: selectedPackage.isUnpublished,
            }
          : null,
        source: activePath,
      };

      const res = await submitSmartContactLead(payload);

      if (!res.success) {
        toast.error(
          res.error ||
            (isAr ? "فشل إرسال الطلب، يرجى المحاولة مرة أخرى." : "Failed to submit request. Please try again.")
        );
        return;
      }

      setSubmittedLead({
        lead: contactInfo,
        packageRec: selectedPackage,
      });
      setStage("success");
      toast.success(
        isAr ? "تم استلام طلبك بنجاح! سنتواصل معك خلال 24 ساعة." : "Request submitted! We will respond within 24 hours."
      );
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCanonicalAnswers({ ...INITIAL_CANONICAL_ANSWERS });
    setEngineResult(null);
    setSelectedPackage(null);
    setSubmittedLead(null);
    setStage("selection");
  };

  return (
    <div className="space-y-10">
      {/* TOP ENTRY HERO (STAGE: SELECTION ONLY) */}
      {stage === "selection" && (
        <div className="text-center max-w-2xl mx-auto space-y-2.5 sm:space-y-3">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary uppercase font-mono">
            {isAr ? "نظام مطابقة الباقات الذكي" : "Smart Package Matcher"}
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-display tracking-tight leading-[1.12] text-foreground text-balance">
            {isAr ? (
              <>فلنجد الحل <span className="text-gradient">المثالي لمشروعك</span>.</>
            ) : (
              <>Let’s find the right solution <span className="text-gradient">for your business</span>.</>
            )}
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {isAr
              ? "شاركنا ما تحتاجه وسنساعدك في اختيار باقة صدى التي تلائم أهدافك وميزانيتك بدقة."
              : "Tell us what you need and we’ll help you find the SADA package that fits your goals."}
          </p>
        </div>
      )}

      {/* THREE CHOICES CARD GRID (STAGE: SELECTION) */}
      <AnimatePresence mode="wait">
        {stage === "selection" && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6"
          >
            {/* 1. Help me choose (Smart Match) */}
            <div
              onClick={() => {
                setActivePath("smart_match");
                setStage("smart_form");
              }}
              className="cursor-pointer group relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between space-y-4 sm:space-y-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="size-11 sm:size-14 rounded-xl sm:rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:scale-105 transition-transform duration-300">
                  <Compass className="size-5 sm:size-7" />
                </div>
                <div className="space-y-1 sm:space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3" />
                    {isAr ? "موصى به للشركات" : "Recommended"}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-foreground group-hover:text-primary transition-colors tracking-tight">
                    {isAr ? "ساعدني في الاختيار" : "Help me choose"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {isAr
                      ? "أجب عن بضعة أسئلة مخصصة واحصل على توصية متوافقة مع أهدافك بدقة."
                      : "Answer a few questions and get a personalized recommendation."}
                  </p>
                </div>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-primary group-hover:underline whitespace-nowrap">
                <span className="shrink-0">{isAr ? "بدء الاستكشاف الذكي" : "Start Smart Match"}</span>
                <ArrowRight className="size-3.5 sm:size-4 shrink-0 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 2. Quick recommendation (Quick Match) */}
            <div
              onClick={() => {
                setActivePath("quick_match");
                setStage("quick_form");
              }}
              className="cursor-pointer group relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between space-y-4 sm:space-y-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="size-11 sm:size-14 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center group-hover:scale-105 transition-transform duration-300">
                  <Zap className="size-5 sm:size-7" />
                </div>
                <div className="space-y-1 sm:space-y-1.5">
                  <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isAr ? "دقيقة واحدة" : "1 Minute"}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-foreground group-hover:text-primary transition-colors tracking-tight">
                    {isAr ? "توصية سريعة" : "Quick recommendation"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {isAr
                      ? "أجب عن 3 أسئلة فقط واحصل على توصية فورية لنشاطك."
                      : "Answer 3 questions and get a fast recommendation."}
                  </p>
                </div>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-primary group-hover:underline whitespace-nowrap">
                <span className="shrink-0">{isAr ? "بدء التوصية السريعة" : "Quick 3 Questions"}</span>
                <ArrowRight className="size-3.5 sm:size-4 shrink-0 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 3. I know what I need (Direct Package) */}
            <div
              onClick={() => {
                setActivePath("direct_package");
                setStage("direct_catalog");
              }}
              className="cursor-pointer group relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between space-y-4 sm:space-y-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="size-11 sm:size-14 rounded-xl sm:rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center group-hover:scale-105 transition-transform duration-300">
                  <Layers className="size-5 sm:size-7" />
                </div>
                <div className="space-y-1 sm:space-y-1.5">
                  <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isAr ? "كتالوج الباقات" : "Direct Intake"}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-foreground group-hover:text-primary transition-colors tracking-tight">
                    {isAr ? "أعرف ما أحتاجه تماماً" : "I know what I need"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {isAr
                      ? "اختر باقة معينة مباشرة من الكتالوج وأرسل طلب التعاقد فوراً."
                      : "Choose a package directly and send your request."}
                  </p>
                </div>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-primary group-hover:underline whitespace-nowrap">
                <span className="shrink-0">{isAr ? "استعراض الباقات العامة" : "Browse Public Catalog"}</span>
                <ArrowRight className="size-3.5 sm:size-4 shrink-0 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE: SMART MATCH LONG FORM */}
        {stage === "smart_form" && (
          <motion.div
            key="smart_form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <SmartMatchLongForm
              initialAnswers={canonicalAnswers}
              onComplete={handleSmartFormComplete}
              onBackToSelection={() => setStage("selection")}
            />
          </motion.div>
        )}

        {/* STAGE: QUICK MATCH FORM */}
        {stage === "quick_form" && (
          <motion.div
            key="quick_form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <QuickMatchForm
              onComplete={handleQuickFormComplete}
              onBackToSelection={() => setStage("selection")}
            />
          </motion.div>
        )}

        {/* STAGE: DIRECT PACKAGE SELECTOR */}
        {stage === "direct_catalog" && (
          <motion.div
            key="direct_catalog"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <DirectPackageSelector
              initialPackageId={initialPackageParam}
              onSelectPackage={handleDirectPackageSelect}
              onBackToSelection={() => setStage("selection")}
            />
          </motion.div>
        )}

        {/* STAGE: RECOMMENDATION RESULT VIEW */}
        {stage === "recommendation" && engineResult && (
          <motion.div
            key="recommendation"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <RecommendationView
              engineResult={engineResult}
              onProceedToContact={handleRecommendationProceed}
              onRetake={() => {
                if (activePath === "quick_match") setStage("quick_form");
                else setStage("smart_form");
              }}
            />
          </motion.div>
        )}

        {/* STAGE: FINAL CONTACT DETAILS FORM */}
        {stage === "contact_form" && (
          <motion.div
            key="contact_form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <ContactDetailsForm
              selectedPackage={selectedPackage}
              onSubmit={handleFinalSubmit}
              onBack={() => {
                if (activePath === "direct_package") setStage("direct_catalog");
                else setStage("recommendation");
              }}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        )}

        {/* STAGE: SUCCESS CONFIRMATION VIEW */}
        {stage === "success" && submittedLead && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <SmartMatchSuccessView
              lead={submittedLead.lead}
              packageRec={submittedLead.packageRec}
              source={activePath}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
