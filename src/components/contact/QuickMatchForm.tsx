// ============================================================
// SADA OS — SMART MATCHER: QUICK MATCH (3 QUESTIONS V2)
// Fast 3-question flow feeding the canonical recommendation engine with FCC typography
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Zap, Target, Layers, DollarSign, Check, Compass } from "lucide-react";
import { SADAButton, SADAProgress, SADACard } from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { useTranslation } from "@/i18n";
import type { CanonicalAnswers } from "@/types/smart-match";
import { INITIAL_CANONICAL_ANSWERS } from "@/types/smart-match";

interface QuickMatchFormProps {
  onComplete: (canonicalAnswers: CanonicalAnswers) => void;
  onBackToSelection: () => void;
}

export function QuickMatchForm({ onComplete, onBackToSelection }: QuickMatchFormProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Quick Match 3 State variables
  const [q1Goal, setQ1Goal] = useState<string>("");
  const [q2Need, setQ2Need] = useState<string>("");
  const [q3Budget, setQ3Budget] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const GOALS = [
    {
      id: "social_growth",
      label: "Social Media Growth",
      labelAr: "نمو الحسابات وصناعة المحتوى",
      desc: "Build audience, publish regular reels, boost engagement",
      descAr: "زيادة المتابعين ونشر ريلز دورية والتفاعل",
    },
    {
      id: "leads_sales",
      label: "More Leads & Sales",
      labelAr: "زيادة العملاء المحتملين والمبيعات",
      desc: "Turn visitors into paying customers and direct inquiries",
      descAr: "تحويل المتابعين إلى مشترين واستفسارات مباشرة",
    },
    {
      id: "paid_ads",
      label: "Paid Advertising",
      labelAr: "الحملات الإعلانية الممولة (Meta Ads)",
      desc: "Laser-targeted reach and predictable ad return",
      descAr: "وصول موجه لجمهورك المستهدف بأعلى عائد استثماري",
    },
    {
      id: "website_digital",
      label: "Website / Digital Presence",
      labelAr: "موقع إلكتروني وحضور رقمي متكامل",
      desc: "Custom landing page, portfolio, or booking system",
      descAr: "صفحة هبوط، موقع أعمال أو نظام حجز متطور",
    },
    {
      id: "not_sure",
      label: "Not sure / Recommend Direction",
      labelAr: "لست متأكداً، أريد توجيهاً استراتيجياً",
      desc: "Looking for recommendations from SADA experts",
      descAr: "أبحث عن استشارة الخبراء لتحديد الأولويات",
    },
  ];

  const NEEDS = [
    {
      id: "content_only",
      label: "Content only",
      labelAr: "إنتاج محتوى فقط",
      desc: "Reels, posts, carousels, and stories creation",
      descAr: "ريلز، بوستات وتصميمات بدون إعلانات ممولة",
    },
    {
      id: "content_ads",
      label: "Content + Ads",
      labelAr: "محتوى + إعلانات ممولة",
      desc: "Creative reels & posts paired with monthly Meta Ads management",
      descAr: "محتوى منتظم مع إدارة إعلانية لتحقيق مبيعات",
    },
    {
      id: "full_marketing",
      label: "Full Marketing",
      labelAr: "تسويق متكامل شامل",
      desc: "Content, advertising, community management & monthly strategy",
      descAr: "محتوى، إعلانات، إدارة مجتمع واستراتيجية نمو",
    },
    {
      id: "marketing_website",
      label: "Marketing + Website",
      labelAr: "تسويق + موقع إلكتروني",
      desc: "Complete digital presence including web platform & conversion funnel",
      descAr: "حضور رقمي متكامل يشمل الموقع ونظام التحويل",
    },
    {
      id: "not_sure",
      label: "Not sure / SADA Strategy",
      labelAr: "لست متأكداً / توليفة صدى",
      desc: "Help me evaluate the best blend for my stage",
      descAr: "ساعدوني في تقييم أفضل توليفة لنشاطي",
    },
  ];

  const BUDGETS = [
    {
      id: "under_700",
      numericValue: 650,
      label: "Under 700 TND",
      labelAr: "أقل من 700 د.ت",
      desc: "Essential starter packs, landing pages, or basic ad setup",
      descAr: "باقات انطلاق أساسية أو صفحات هبوط مخصصة",
    },
    {
      id: "700_1200",
      numericValue: 950,
      label: "700 – 1 200 TND",
      labelAr: "700 – 1 200 د.ت",
      desc: "Standard monthly retainer with regular reels and copy",
      descAr: "اشتراك شهري منتظم بريلز وتصميمات أسبوعية",
    },
    {
      id: "1200_2000",
      numericValue: 1600,
      label: "1 200 – 2 000 TND",
      labelAr: "1 200 – 2 000 د.ت",
      desc: "Comprehensive growth package with video and Meta Ads",
      descAr: "باقة نمو شاملة تشمل تصوير الفيديو وحملات Meta",
    },
    {
      id: "2000_plus",
      numericValue: 2490,
      label: "2 000+ TND",
      labelAr: "أكثر من 2 000 د.ت",
      desc: "High-growth dominance, multi-channel scale, and full creative team",
      descAr: "تسارع نمو مكثف، تغطية شاملة وفريق إنتاج متكامل",
    },
    {
      id: "not_sure",
      numericValue: null,
      label: "Flexible / Recommend Best ROI",
      labelAr: "مرن / اقترحوا عليّ الأنسب",
      desc: "Open to recommendations based on business goals",
      descAr: "منفتح على الاقتراحات بحسب عائد الاستثمار المتوقع",
    },
  ];

  const handleNext = () => {
    setErrorMsg("");

    if (currentStep === 1) {
      if (!q1Goal) {
        setErrorMsg(isAr ? "يرجى اختيار هدفك الرئيسي" : "Please select your primary goal.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!q2Need) {
        setErrorMsg(isAr ? "يرجى اختيار نطاق الخدمات التي تحتاجها" : "Please select what you need most.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!q3Budget) {
        setErrorMsg(isAr ? "يرجى تحديد ميزانيتك التقديرية" : "Please select your comfortable investment.");
        return;
      }

      // Map to Canonical Answer Model
      const canonical: CanonicalAnswers = {
        ...INITIAL_CANONICAL_ANSWERS,
        primaryGoals:
          q1Goal === "social_growth"
            ? ["Grow social media presence", "Create consistent content"]
            : q1Goal === "leads_sales"
            ? ["Get more leads", "Get more sales"]
            : q1Goal === "paid_ads"
            ? ["Run paid advertising"]
            : q1Goal === "website_digital"
            ? ["Build a website", "Improve online presence"]
            : ["Not sure yet"],
        requiredServices:
          q2Need === "content_only"
            ? ["Reels / Video Content", "Posts / Carousels", "Stories"]
            : q2Need === "content_ads"
            ? ["Reels / Video Content", "Posts / Carousels", "Meta Ads"]
            : q2Need === "full_marketing"
            ? ["Reels / Video Content", "Posts / Carousels", "Meta Ads", "Community Management", "Strategy"]
            : q2Need === "marketing_website"
            ? ["Reels / Video Content", "Posts / Carousels", "Meta Ads", "Website"]
            : [],
        contentIntensity:
          q2Need === "content_only" || q2Need === "content_ads"
            ? "active"
            : q2Need === "full_marketing"
            ? "high_growth"
            : null,
        advertisingNeed:
          q2Need === "content_ads" || q2Need === "full_marketing" || q2Need === "marketing_website"
            ? "every_month"
            : q2Need === "content_only"
            ? "no"
            : "not_sure",
        websiteNeed:
          q2Need === "marketing_website"
            ? "website"
            : q1Goal === "website_digital"
            ? "website"
            : q2Need === "content_only"
            ? "no"
            : "not_sure",
        budgetRange: q3Budget as any,
      };

      onComplete(canonical);
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBackToSelection();
    }
  };

  const progressPercent = Math.round((currentStep / 3) * 100);

  const stepLabels = [
    { num: "01", name: isAr ? "الهدف الأساسي" : "YOUR OBJECTIVE" },
    { num: "02", name: isAr ? "نطاق الخدمات" : "SERVICE SCOPE" },
    { num: "03", name: isAr ? "الاستثمار الشهري" : "MONTHLY INVESTMENT" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Progress & Header */}
      <div className="space-y-3 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5 text-primary font-mono text-[11px] font-bold uppercase tracking-wider">
            <Zap className="size-3.5" />
            {stepLabels[currentStep - 1].num} — {stepLabels[currentStep - 1].name}
          </span>
          <span className="font-mono text-xs tabular-nums text-foreground">
            <span className="text-primary font-bold">{`0${currentStep}`}</span> / 03
          </span>
        </div>
        <SADAProgress value={progressPercent} className="h-1.5 bg-muted" />
      </div>

      {/* Main Question Card */}
      <SADACard className="p-6 sm:p-8 border-border bg-card/85 backdrop-blur-sm shadow-xl">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5 border-b border-border/80 pb-4">
                <div className="text-[11px] font-bold font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Target className="size-3.5" />
                  {isAr ? "01 — الهدف الرئيسي" : "01 — YOUR OBJECTIVE"}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground">
                  {isAr ? "ما هو هدفك الرئيسي الآن؟" : "What’s your main goal?"}
                </h3>
              </div>

              <div className="space-y-2.5">
                {GOALS.map((opt) => {
                  const isSelected = q1Goal === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setQ1Goal(opt.id);
                        setErrorMsg("");
                      }}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[50px] ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm sm:text-base text-foreground font-display">
                          {isAr ? opt.labelAr : opt.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isAr ? opt.descAr : opt.desc}
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-muted-foreground/30 bg-muted/20"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5 border-b border-border/80 pb-4">
                <div className="text-[11px] font-bold font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  {isAr ? "02 — نطاق الخدمات" : "02 — SERVICE SCOPE"}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground">
                  {isAr ? "ما الذي تحتاجه أكثر في هذه المرحلة؟" : "What do you need most?"}
                </h3>
              </div>

              <div className="space-y-2.5">
                {NEEDS.map((opt) => {
                  const isSelected = q2Need === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setQ2Need(opt.id);
                        setErrorMsg("");
                      }}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[50px] ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm sm:text-base text-foreground font-display">
                          {isAr ? opt.labelAr : opt.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isAr ? opt.descAr : opt.desc}
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-muted-foreground/30 bg-muted/20"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5 border-b border-border/80 pb-4">
                <div className="text-[11px] font-bold font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <DollarSign className="size-3.5" />
                  {isAr ? "03 — الاستثمار المالي" : "03 — MONTHLY INVESTMENT"}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground">
                  {isAr ? "ما هي ميزانيتك الشهرية المريحة؟" : "What’s your comfortable monthly investment?"}
                </h3>
              </div>

              <div className="space-y-2.5">
                {BUDGETS.map((opt) => {
                  const isSelected = q3Budget === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setQ3Budget(opt.id);
                        setErrorMsg("");
                      }}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[50px] ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm sm:text-base text-foreground font-display flex items-center gap-2">
                          {opt.numericValue !== null ? (
                            <SADANumber
                              variant="kpi"
                              value={opt.numericValue}
                              currency="TND"
                              className="text-foreground"
                            />
                          ) : (
                            <span>{isAr ? opt.labelAr : opt.label}</span>
                          )}
                          <span className="text-xs font-normal text-muted-foreground font-sans">
                            {opt.numericValue !== null ? (isAr ? opt.labelAr : opt.label) : ""}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isAr ? opt.descAr : opt.desc}
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-muted-foreground/30 bg-muted/20"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errorMsg && (
          <p className="text-xs text-rose-500 font-semibold mt-4">{errorMsg}</p>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border gap-3">
          <SADAButton variant="outline" onClick={handleBack} className="gap-2 min-h-[44px] px-5 whitespace-nowrap shrink-0">
            <ArrowLeft className="size-4 rtl:rotate-180 shrink-0" />
            <span className="whitespace-nowrap">{isAr ? "رجوع" : "Back"}</span>
          </SADAButton>

          <SADAButton variant="primary" onClick={handleNext} className="gap-2 font-bold min-h-[44px] px-6 whitespace-nowrap shrink-0">
            <span className="whitespace-nowrap">
              {currentStep === 3
                ? (isAr ? "استخراج الباقة الموصى بها" : "Show Best Fit Recommendation")
                : (isAr ? "متابعة" : "Continue")}
            </span>
            <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
          </SADAButton>
        </div>
      </SADACard>
    </div>
  );
}
