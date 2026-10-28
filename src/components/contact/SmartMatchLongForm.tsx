// ============================================================
// SADA OS — SMART MATCHER: LONG FORM (4-STEP STRATEGIC CONSULTATION)
// Guided consultation UX, grouped logic, interactive cards, Financial Command Center typography
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Check,
  Building2,
  Target,
  Layers,
  Sparkles,
  Zap,
  DollarSign,
  Calendar,
  MessageSquare,
  HelpCircle,
  Clock,
  ShieldCheck,
  UtensilsCrossed,
  ShoppingBag,
  Plane,
  Store,
  Briefcase,
  User,
  Globe,
  TrendingUp,
  Video,
  Monitor,
  CheckCircle2,
} from "lucide-react";
import {
  SADAButton,
  SADAProgress,
  SADACard,
  SADATextarea,
  SADABadge,
} from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { useTranslation } from "@/i18n";
import type { CanonicalAnswers } from "@/types/smart-match";
import { INITIAL_CANONICAL_ANSWERS } from "@/types/smart-match";

interface SmartMatchLongFormProps {
  initialAnswers?: CanonicalAnswers;
  onComplete: (answers: CanonicalAnswers) => void;
  onBackToSelection: () => void;
}

export function SmartMatchLongForm({
  initialAnswers,
  onComplete,
  onBackToSelection,
}: SmartMatchLongFormProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  // 4 Guided Strategic Consultation Steps
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;

  // Answers State
  const [answers, setAnswers] = useState<CanonicalAnswers>(
    initialAnswers || { ...INITIAL_CANONICAL_ANSWERS }
  );

  const [validationError, setValidationError] = useState<string>("");

  const updateAnswer = <K extends keyof CanonicalAnswers>(
    field: K,
    value: CanonicalAnswers[K]
  ) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setValidationError("");
  };

  const toggleMultiSelect = (
    field: "primaryGoals" | "requiredServices",
    item: string
  ) => {
    setAnswers((prev) => {
      const currentList = prev[field] || [];
      const exists = currentList.includes(item);
      const updated = exists
        ? currentList.filter((x) => x !== item)
        : [...currentList, item];
      return { ...prev, [field]: updated };
    });
    setValidationError("");
  };

  // ==========================================
  // STEP 01 — OBJECTIVE OPTIONS
  // ==========================================
  const GOAL_OPTIONS = [
    {
      id: "Grow social media presence",
      icon: TrendingUp,
      title: "Social Media Growth",
      titleAr: "نمو الحسابات وصناعة المحتوى",
      desc: "Build a stronger audience, elevate production quality, and establish a consistent brand presence.",
      descAr: "بناء جمهور واسع، رفع جودة الإنتاج، وترسيخ حضور رقمي منتظم ومؤثر.",
      badge: "High Velocity",
      badgeAr: "نمو متسارع",
    },
    {
      id: "Get more leads",
      icon: Target,
      title: "More Leads & Inquiries",
      titleAr: "استقطاب عملاء واستفسارات مؤهلة",
      desc: "Turn passive social attention into qualified business inquiries, bookings, and consultation requests.",
      descAr: "تحويل المتابعين إلى مشترين واستفسارات مباشرة وحجوزات مؤكدة.",
      badge: "Performance",
      badgeAr: "أداء مباشر",
    },
    {
      id: "Run paid advertising",
      icon: Zap,
      title: "Paid Advertising (Meta Ads)",
      titleAr: "الحملات الإعلانية الممولة",
      desc: "Reach the exact target audience, optimize customer acquisition cost, and scale revenue predictably.",
      descAr: "وصول موجه بدقة للشريحة المستهدفة وتحقيق أعلى عائد استثماري على الميزانية.",
      badge: "Acquisition",
      badgeAr: "اكتساب عملاء",
    },
    {
      id: "Build a website",
      icon: Monitor,
      title: "Website & Digital Presence",
      titleAr: "موقع إلكتروني وحضور رقمي متكامل",
      desc: "Build a bespoke digital experience, brand portal, conversion funnel, or online booking engine.",
      descAr: "بناء موقع ويب راقٍ، متجر إلكتروني، أو نظام حجز وتحويل يعزز هيبة علامتك.",
      badge: "Conversion",
      badgeAr: "تحويل رقمي",
    },
    {
      id: "Build a stronger brand",
      icon: Sparkles,
      title: "Brand Authority & Positioning",
      titleAr: "ترسيخ الهوية والتموضع الراقي",
      desc: "Elevate your visual perception, articulate your value proposition, and command premium pricing.",
      descAr: "الارتقاء بالانطباع البصري، إبراز القيمة الفريدة، ومخاطبة نخبة العملاء.",
      badge: "Prestige",
      badgeAr: "مكانة مرموقة",
    },
    {
      id: "Create consistent content",
      icon: Video,
      title: "Consistent Creative Engine",
      titleAr: "منظومة إنتاج محتوى مستمرة",
      desc: "Streamline monthly Reels, carousels, and stories production without internal friction or fatigue.",
      descAr: "ضمان تدفق أسبوعي مستمر من الريلز والتصاميم الاحترافية دون إرهاق فريقك الداخلي.",
      badge: "Retainer",
      badgeAr: "إنتاج شهري",
    },
    {
      id: "Not sure yet",
      icon: Compass,
      title: "Strategic Recommendation",
      titleAr: "لست متأكداً، أريد توجيهاً استراتيجياً",
      desc: "Let SADA evaluate your business stage and recommend the optimal strategic roadmap for you.",
      descAr: "دع خبراء صدى يقيّمون وضع نشاطك ويقترحون المسار الأنسب لنموك.",
      badge: "Consultative",
      badgeAr: "استشارة صدى",
    },
  ];

  // ==========================================
  // STEP 02 — BUSINESS CONTEXT OPTIONS
  // ==========================================
  const BUSINESS_TYPES = [
    { id: "Restaurant / Café", icon: UtensilsCrossed, label: "Restaurant / Café", labelAr: "مطعم / مقهى" },
    { id: "E-commerce", icon: ShoppingBag, label: "E-commerce & Retail", labelAr: "تجارة إلكترونية وتجزئة" },
    { id: "Beauty / Cosmetics", icon: Sparkles, label: "Beauty & Cosmetics", labelAr: "تجميل وعناية فاخرة" },
    { id: "Travel / Tourism", icon: Plane, label: "Travel & Hospitality", labelAr: "سياحة وفندقة وضيافة" },
    { id: "Real Estate", icon: Building2, label: "Real Estate & Architecture", labelAr: "عقارات وتطوير عقاري" },
    { id: "Personal Brand", icon: User, label: "Personal Brand & Executive", labelAr: "علامة شخصية وقادة أعمال" },
    { id: "Local Business", icon: Store, label: "Local Commercial Business", labelAr: "نشاط تجاري وخدمي محلي" },
    { id: "Service Business", icon: Briefcase, label: "Professional B2B Services", labelAr: "خدمات واستشارات شركات" },
    { id: "Other", icon: Layers, label: "Other Industry", labelAr: "قطاع ومجال آخر" },
  ];

  const BUSINESS_STAGES = [
    {
      id: "starting",
      label: "Launching / Just Starting",
      labelAr: "مرحلة الانطلاق والتأسيس",
      desc: "Establishing initial brand identity, launching social presence, or preparing market entry.",
      descAr: "تأسيس الهوية الرقمية، تدشين الحسابات، ودخول السوق بقوة وثقة.",
    },
    {
      id: "operating_growth",
      label: "Operating & Seeking Growth",
      labelAr: "مشروع قائم يبحث عن تسارع النمو",
      desc: "Active business with existing customers, ready to scale reach and professionalize digital output.",
      descAr: "نشاط لديه عملاء حاليون، جاهز لمضاعفة الحضور والارتقاء بالمستوى الإخراجي.",
    },
    {
      id: "growing_quickly",
      label: "Scaling Quickly",
      labelAr: "نمو سريع يحتاج هيكلة متقدمة",
      desc: "High volume of orders or inquiries, requiring consistent multi-channel marketing execution.",
      descAr: "تدفق سريع للطلبات والاستفسارات يحتاج إدارة إعلانية احترافية وتغطية متواصلة.",
    },
    {
      id: "established",
      label: "Established Market Leader",
      labelAr: "شركة راسخة تبحث عن الريادة والتميز",
      desc: "Recognized industry player maintaining market leadership with prestige creative direction.",
      descAr: "علامة معتمدة تحافظ على ريادتها وتطلب إنتاجاً سينمائياً وتوجيهاً استراتيجياً رفيعاً.",
    },
  ];

  const MARKET_SCOPES = [
    { id: "Local / one area", label: "Local (City / Region)", labelAr: "محلي (مدينة أو منطقة محددة)" },
    { id: "Multiple cities", label: "Multiple Cities", labelAr: "مدن ومناطق متعددة" },
    { id: "Tunisia-wide", label: "Tunisia-wide", labelAr: "كامل تراب الجمهورية" },
    { id: "International", label: "International / Export", labelAr: "دولي وتصدير للأسواق الخارجية" },
  ];

  // ==========================================
  // STEP 03 — SERVICES & BUDGET
  // ==========================================
  const SERVICES_LIST = [
    { id: "Reels / Video Content", icon: Video, label: "Reels & Short-Form Video", labelAr: "ريلز ومحتوى فيديو حركي" },
    { id: "Posts / Carousels", icon: Layers, label: "Posts & Luxury Carousels", labelAr: "منشورات وكاروسيل وتصاميم" },
    { id: "Stories", icon: Sparkles, label: "Weekly Strategic Stories", labelAr: "ستوريز تفاعلية مستمرة" },
    { id: "Meta Ads", icon: Zap, label: "Meta Ads & Funnel Growth", labelAr: "إعلانات فيسبوك وانستغرام الممولة" },
    { id: "Community Management", icon: MessageSquare, label: "Community Management", labelAr: "إدارة التفاعل والرد على الرسائل" },
    { id: "Copywriting", icon: Target, label: "Copywriting & Scripts", labelAr: "كتابة إعلانية وسيناريوهات" },
    { id: "Website", icon: Monitor, label: "Website / Web Funnel", labelAr: "تصميم وتطوير موقع إلكتروني" },
    { id: "SEO", icon: Globe, label: "Search Engine Optimization (SEO)", labelAr: "تحسين محركات البحث SEO" },
    { id: "Booking / Ordering System", icon: CheckCircle2, label: "Booking & Conversion System", labelAr: "نظام حجز أو طلبات أونلاين" },
    { id: "Strategy", icon: Compass, label: "Brand Strategy & Positioning", labelAr: "استراتيجية وتموضع تسويقي" },
    { id: "Production Sessions", icon: Video, label: "On-Site Production Days", labelAr: "جلسات تصوير ميداني وإنتاج احترافي" },
    { id: "Performance Reporting", icon: TrendingUp, label: "Executive Analytics & ROI", labelAr: "تقارير أداء دورية وتحليل عائد" },
  ];

  const BUDGET_RANGES = [
    {
      id: "under_700",
      numericLabel: "Under 700 TND",
      numericValue: 650,
      labelAr: "أقل من 700 د.ت",
      desc: "Targeted starter sprints, essential landing page, or specialized single deliverable.",
      descAr: "باقات انطلاق مركزة، صفحة هبوط تعريفي، أو خدمات إعلانية مقتضبة.",
    },
    {
      id: "700_1200",
      numericLabel: "700 – 1 200 TND",
      numericValue: 950,
      labelAr: "700 – 1 200 د.ت",
      desc: "Standard monthly retainer with regular reels, luxury copy, and community oversight.",
      descAr: "اشتراك شهري متوازن بريلز منتظمة، كتابة إعلانية، وإدارة للحساب.",
    },
    {
      id: "1200_2000",
      numericLabel: "1 200 – 2 000 TND",
      numericValue: 1600,
      labelAr: "1 200 – 2 000 د.ت",
      desc: "Comprehensive growth engine combining weekly video production, Meta Ads, and design.",
      descAr: "منظومة نمو متكاملة تجمع تصوير الفيديو الأسبوعي، إعلانات Meta، والتصاميم.",
    },
    {
      id: "2000_plus",
      numericLabel: "2 000+ TND",
      numericValue: 2490,
      labelAr: "أكثر من 2 000 د.ت",
      desc: "High-tier multi-platform dominance, custom web systems, and full-scale production team.",
      descAr: "حضور رقمي واسع، موقع متقدم أو منصة تحويل، وفريق إنتاج ميداني متكامل.",
    },
    {
      id: "not_sure",
      numericLabel: "Flexible / Recommend for ROI",
      numericValue: null,
      labelAr: "مرن / أريد توصية مبنية على العائد",
      desc: "Let SADA recommend the budget tier that delivers the highest return for your goals.",
      descAr: "سنقترح عليك الاستثمار الأكفأ لتحقيق أهدافك بأعلى عائد ممكن.",
    },
  ];

  // ==========================================
  // STEP 04 — EXECUTION SCOPE & TIMELINE
  // ==========================================
  const CONTENT_INTENSITIES = [
    {
      id: "light",
      label: "Light Cadence",
      labelAr: "حضور أساسي متوازن",
      desc: "A consistent baseline presence (4–8 refined assets / month).",
      descAr: "حضور منتظم ومركز بجودة عالية (4 إلى 8 مخرجات شهرياً).",
    },
    {
      id: "active",
      label: "Active Growth",
      labelAr: "نمو وتواجد نشط",
      desc: "Regular content throughout the month (12–16 assets / month).",
      descAr: "نشر متواصل ومؤثر طوال الشهر (12 إلى 16 مخرجاً شهرياً).",
    },
    {
      id: "high_growth",
      label: "High-Frequency Dominance",
      labelAr: "تسارع نمو مكثف",
      desc: "High-velocity content, on-site shooting sessions, and heavy paid scaling.",
      descAr: "كثافة نشر مرتفعة، تصوير ميداني منتظم، وتوسع إعلاني مكثف.",
    },
  ];

  const ADVERTISING_NEEDS = [
    { id: "every_month", label: "Yes, every month", labelAr: "نعم، شهرياً وبشكل مستمر" },
    { id: "occasionally", label: "Seasonally / Campaigns", labelAr: "حملات موسمية ومناسبات" },
    { id: "no", label: "Not at this time", labelAr: "لا، ليس في الوقت الحالي" },
    { id: "not_sure", label: "Recommend best approach", labelAr: "اقترحوا عليّ الخيار الأنسب" },
  ];

  const WEBSITE_NEEDS = [
    { id: "no", label: "No website needed", labelAr: "لا أحتاج موقعاً حالياً" },
    { id: "website", label: "Yes, showcase website", labelAr: "نعم، موقع تعريفي راقٍ" },
    { id: "booking_system", label: "Yes, with booking / store engine", labelAr: "نعم، موقع بنظام حجز أو متجر" },
    { id: "maybe_later", label: "Future roadmap item", labelAr: "مستقبلاً في مرحلة لاحقة" },
  ];

  const TIMELINES = [
    { id: "asap", label: "As soon as possible", labelAr: "في أقرب وقت ممكن" },
    { id: "this_month", label: "Within this month", labelAr: "خلال هذا الشهر" },
    { id: "next_month", label: "Next month", labelAr: "الشهر القادم" },
    { id: "exploring", label: "Evaluating options", labelAr: "في مرحلة الاستكشاف حالياً" },
  ];

  // ==========================================
  // STEP VALIDATION & NAVIGATION
  // ==========================================
  const handleNext = () => {
    setValidationError("");

    if (currentStep === 1) {
      if (!answers.primaryGoals || answers.primaryGoals.length === 0) {
        setValidationError(
          isAr
            ? "يرجى اختيار هدف رئيسي واحد على الأقل للمتابعة."
            : "Please select at least one primary objective to guide our match."
        );
        return;
      }
    } else if (currentStep === 2) {
      if (!answers.businessType) {
        setValidationError(
          isAr
            ? "يرجى تحديد قطاع أو نوع نشاطك التجاري."
            : "Please select your business type so we can calibrate capacity."
        );
        return;
      }
    } else if (currentStep === 3) {
      if (!answers.budgetRange) {
        setValidationError(
          isAr
            ? "يرجى اختيار النطاق التقديري للميزانية المريحة لك."
            : "Please select a comfortable monthly investment tier."
        );
        return;
      }
    } else if (currentStep === 4) {
      // Step 4 is complete -> trigger matching engine!
      onComplete(answers);
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setValidationError("");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onBackToSelection();
    }
  };

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const stepLabels = [
    { num: "01", name: isAr ? "الهدف الاستراتيجي" : "YOUR OBJECTIVE" },
    { num: "02", name: isAr ? "سياق النشاط" : "BUSINESS CONTEXT" },
    { num: "03", name: isAr ? "متطلبات النمو والميزانية" : "GROWTH REQUIREMENTS" },
    { num: "04", name: isAr ? "نطاق التنفيذ والتأكيد" : "EXECUTION & BRIEF" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Refined Progress Bar with Financial Command Center numeral aesthetics */}
      <div className="space-y-3 bg-card/40 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-border">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-2 text-primary">
            <Compass className="size-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
              {stepLabels[currentStep - 1].num} — {stepLabels[currentStep - 1].name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-foreground">
            <span className="text-primary font-bold">{`0${currentStep}`}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{`0${totalSteps}`}</span>
          </div>
        </div>

        {/* Step Progression Visual Dots & Line */}
        <div className="relative pt-1">
          <SADAProgress value={progressPercent} className="h-1.5 bg-muted" />
          <div className="flex justify-between items-center mt-2">
            {stepLabels.map((s, idx) => {
              const isPast = currentStep > idx + 1;
              const isCurrent = currentStep === idx + 1;
              return (
                <div
                  key={s.num}
                  className={`flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider transition-colors ${
                    isCurrent
                      ? "text-primary font-semibold"
                      : isPast
                      ? "text-foreground/70"
                      : "text-muted-foreground/50"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full transition-all ${
                      isCurrent
                        ? "bg-primary ring-4 ring-primary/20 scale-125"
                        : isPast
                        ? "bg-primary/80"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className="hidden sm:inline font-mono">{s.num}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Strategic Consultation Card */}
      <SADACard className="p-6 sm:p-9 border-border bg-card/80 backdrop-blur-sm shadow-xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 size-60 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {/* ============================================================
              STEP 01: YOUR OBJECTIVE
             ============================================================ */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Contextual Consultation Header */}
              <div className="space-y-2 border-b border-border/80 pb-5">
                <div className="text-[11px] font-bold font-mono tracking-widest uppercase text-primary flex items-center gap-1.5">
                  <Target className="size-3.5" />
                  {isAr ? "01 — الهدف الاستراتيجي" : "01 — YOUR OBJECTIVE"}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                  {isAr
                    ? "ما هو الهدف الأكبر الذي تريد أن تساعدك صدى في تحقيقه؟"
                    : "What’s the biggest thing you want SADA to help you achieve?"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "اختر النتيجة الأكثر أهمية لمشروعك الآن. سنعتمد عليها لتوجيه وتخصيص الباقة المثالية."
                    : "Choose the outcome that matters most right now. We'll use this to prioritize the right services and velocity."}
                </p>
              </div>

              {/* Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {GOAL_OPTIONS.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = answers.primaryGoals.includes(goal.id);
                  const isNotSure = goal.id === "Not sure yet";

                  return (
                    <div
                      key={goal.id}
                      onClick={() => toggleMultiSelect("primaryGoals", goal.id)}
                      className={`cursor-pointer min-h-[108px] rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3 text-start relative group ${
                        isSelected
                          ? "border-primary bg-primary/[0.08] shadow-md ring-1 ring-primary/50"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                      } ${isNotSure ? "sm:col-span-2 border-dashed" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-10 rounded-xl grid place-items-center transition-colors shrink-0 ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                            }`}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block font-mono">
                              {isAr ? goal.badgeAr : goal.badge}
                            </span>
                            <h4 className="font-bold text-foreground text-sm sm:text-base font-display">
                              {isAr ? goal.titleAr : goal.title}
                            </h4>
                          </div>
                        </div>

                        {/* Selected Indicator */}
                        <div
                          className={`size-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-muted-foreground/30 bg-muted/20 group-hover:border-primary/50"
                          }`}
                        >
                          {isSelected && <Check className="size-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isAr ? goal.descAr : goal.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ============================================================
              STEP 02: BUSINESS CONTEXT
             ============================================================ */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Contextual Header */}
              <div className="space-y-2 border-b border-border/80 pb-5">
                <div className="text-[11px] font-bold font-mono tracking-widest uppercase text-primary flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  {isAr ? "02 — سياق النشاط التجاري" : "02 — BUSINESS CONTEXT"}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                  {isAr ? "أخبرنا عن طبيعة ومرحلة نشاطك التجاري." : "Tell us about your business."}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "هذه التفاصيل تضمن أن الباقة المقترحة مصممة لاحتياجات قطاعك ومرحلة تطورك الفعلية."
                    : "This helps SADA calibrate industry-specific production capacity and operational velocity."}
                </p>
              </div>

              {/* 1. Sector Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                  {isAr ? "القطاع التجاري *" : "Business Sector *"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {BUSINESS_TYPES.map((b) => {
                    const Icon = b.icon;
                    const isSelected = answers.businessType === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => updateAnswer("businessType", b.id)}
                        className={`min-h-[50px] p-3 rounded-xl border text-start transition-all flex items-center justify-between gap-2.5 text-xs font-medium ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-card text-foreground/90 hover:bg-muted/40 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon className={`size-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="truncate">{isAr ? b.labelAr : b.label}</span>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Business Stage */}
              <div className="space-y-3 pt-5 border-t border-border/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                  {isAr ? "مرحلة النشاط الحالية" : "Current Business Stage"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUSINESS_STAGES.map((bs) => {
                    const isSelected = answers.businessStage === bs.id;
                    return (
                      <div
                        key={bs.id}
                        onClick={() => updateAnswer("businessStage", bs.id as any)}
                        className={`cursor-pointer rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-1.5 text-start ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-card hover:bg-muted/30 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            {isAr ? bs.labelAr : bs.label}
                          </span>
                          {isSelected && <Check className="size-3.5 text-primary stroke-[3]" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {isAr ? bs.descAr : bs.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Market Scope */}
              <div className="space-y-2.5 pt-4 border-t border-border/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                  {isAr ? "نطاق التغطية والجمهور المستهدف" : "Target Market Scope"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MARKET_SCOPES.map((m) => {
                    const isSelected = answers.marketScope === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateAnswer("marketScope", isSelected ? null : m.id)}
                        className={`min-h-[44px] p-2.5 rounded-xl border text-center transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/90"
                        }`}
                      >
                        {isAr ? m.labelAr : m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              STEP 03: GROWTH REQUIREMENTS
             ============================================================ */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Contextual Header */}
              <div className="space-y-2 border-b border-border/80 pb-5">
                <div className="text-[11px] font-bold font-mono tracking-widest uppercase text-primary flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  {isAr ? "03 — متطلبات النمو والميزانية" : "03 — GROWTH REQUIREMENTS"}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                  {isAr
                    ? "ما هي الخدمات ومستوى الاستثمار المتوافق مع طموحك؟"
                    : "What services and investment level match your vision?"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "حدد الخدمات التي تحتاجها في خطتك الشهرية، والميزانية المريحة لنشاطك."
                    : "Select the capabilities you want included in your scope, and your comfortable monthly investment tier."}
                </p>
              </div>

              {/* 1. Services Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                    {isAr ? "الخدمات والمخرجات المطلوبة (اختيار متعدد)" : "Requested Services & Deliverables"}
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {answers.requiredServices.length} {isAr ? "محددة" : "selected"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SERVICES_LIST.map((srv) => {
                    const Icon = srv.icon;
                    const isChecked = answers.requiredServices.includes(srv.id);
                    return (
                      <div
                        key={srv.id}
                        onClick={() => toggleMultiSelect("requiredServices", srv.id)}
                        className={`cursor-pointer min-h-[46px] p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                          isChecked
                            ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-card text-foreground/80 hover:bg-muted/40 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`size-4 shrink-0 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="truncate">{isAr ? srv.labelAr : srv.label}</span>
                        </div>
                        <div
                          className={`size-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-muted-foreground/30 bg-muted/20"
                          }`}
                        >
                          {isChecked && <Check className="size-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Monthly Investment Range */}
              <div className="space-y-3 pt-5 border-t border-border/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                  <DollarSign className="size-3.5 text-primary" />
                  {isAr ? "الاستثمار الشهري التقديري *" : "Estimated Monthly Investment *"}
                </label>

                <div className="space-y-2.5">
                  {BUDGET_RANGES.map((b) => {
                    const isSelected = answers.budgetRange === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => updateAnswer("budgetRange", b.id as any)}
                        className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between gap-4 text-start ${
                          isSelected
                            ? "border-primary bg-primary/[0.08] shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-card hover:bg-muted/30 hover:border-primary/40"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm sm:text-base text-foreground font-display flex items-center gap-2">
                            {b.numericValue !== null ? (
                              <SADANumber
                                variant="kpi"
                                value={b.numericValue}
                                currency="TND"
                                className="text-foreground"
                              />
                            ) : (
                              <span>{isAr ? b.labelAr : b.numericLabel}</span>
                            )}
                            <span className="text-xs font-normal text-muted-foreground font-sans">
                              {b.numericValue !== null ? (isAr ? b.labelAr : b.numericLabel) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isAr ? b.descAr : b.desc}
                          </p>
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
              </div>
            </motion.div>
          )}

          {/* ============================================================
              STEP 04: EXECUTION DETAILS & BRIEF REVIEW
             ============================================================ */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Contextual Header */}
              <div className="space-y-2 border-b border-border/80 pb-5">
                <div className="text-[11px] font-bold font-mono tracking-widest uppercase text-primary flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  {isAr ? "04 — تفاصيل التنفيذ ومراجعة الطلب" : "04 — EXECUTION & BRIEF REVIEW"}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                  {isAr ? "ضع اللمسات الأخيرة قبل استخراج التوصية." : "Fine-tune your roadmap."}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "حدد وتيرة النشر وموعد الانطلاق المتوقع لنقدم لك التوصية الأكثر دقة."
                    : "Clarify content velocity, launch timeline, and any special notes before our engine ranks your best-fit packages."}
                </p>
              </div>

              {/* 1. Content Intensity */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                  {isAr ? "كثافة ووتيرة النشر المطلوبة" : "Desired Content Intensity"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {CONTENT_INTENSITIES.map((ci) => {
                    const isSelected = answers.contentIntensity === ci.id;
                    return (
                      <div
                        key={ci.id}
                        onClick={() => updateAnswer("contentIntensity", ci.id as any)}
                        className={`cursor-pointer p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 text-start ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-card hover:bg-muted/30 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            {isAr ? ci.labelAr : ci.label}
                          </span>
                          {isSelected && <Check className="size-3.5 text-primary stroke-[3]" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {isAr ? ci.descAr : ci.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Paid Ads & Website Needs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/80">
                {/* Ads preference */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                    {isAr ? "الإعلانات الممولة (Meta Ads)" : "Paid Meta Ads Need"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ADVERTISING_NEEDS.map((ad) => {
                      const isSelected = answers.advertisingNeed === ad.id;
                      return (
                        <button
                          key={ad.id}
                          type="button"
                          onClick={() => updateAnswer("advertisingNeed", ad.id as any)}
                          className={`min-h-[44px] p-2.5 rounded-xl border text-center transition-all text-xs font-medium ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                          }`}
                        >
                          {isAr ? ad.labelAr : ad.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Website preference */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                    {isAr ? "الموقع والنظام الرقمي" : "Website Platform Need"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEBSITE_NEEDS.map((wb) => {
                      const isSelected = answers.websiteNeed === wb.id;
                      return (
                        <button
                          key={wb.id}
                          type="button"
                          onClick={() => updateAnswer("websiteNeed", wb.id as any)}
                          className={`min-h-[44px] p-2.5 rounded-xl border text-center transition-all text-xs font-medium ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                          }`}
                        >
                          {isAr ? wb.labelAr : wb.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Timeline */}
              <div className="space-y-2 pt-4 border-t border-border/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  {isAr ? "موعد الانطلاق المتوقع" : "Target Launch Timeline"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIMELINES.map((tm) => {
                    const isSelected = answers.startTimeline === tm.id;
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => updateAnswer("startTimeline", tm.id as any)}
                        className={`min-h-[44px] p-2.5 rounded-xl border text-center transition-all text-xs font-medium ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                      >
                        {isAr ? tm.labelAr : tm.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Additional Context (Optional) */}
              <div className="space-y-2 pt-4 border-t border-border/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  {isAr ? "ملاحظات أو روابط إضافية (اختياري)" : "Additional Strategic Notes (Optional)"}
                </label>
                <SADATextarea
                  rows={2}
                  value={answers.additionalContext || ""}
                  onChange={(e) => updateAnswer("additionalContext", e.target.value)}
                  placeholder={
                    isAr
                      ? "شاركنا روابط حساباتك، هوية منافسيك، أو أي تفاصيل ترغب في أن يركز عليها الفريق..."
                      : "Share your social links, competitor references, or specific expectations..."
                  }
                  className="text-xs"
                />
              </div>

              {/* 5. Strategic Brief Summary Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-primary/20 bg-primary/[0.03] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-primary font-mono">
                  <span>{isAr ? "ملخص الاستشارة الاستراتيجية" : "Strategic Brief Summary"}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">{isAr ? "جاهز للمطابقة" : "Ready to Match"}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                      {isAr ? "القطاع" : "Sector"}
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {answers.businessType || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                      {isAr ? "المرحلة" : "Stage"}
                    </span>
                    <span className="font-semibold text-foreground truncate block capitalize">
                      {answers.businessStage ? answers.businessStage.replace("_", " ") : "Operating"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                      {isAr ? "الميزانية" : "Budget Tier"}
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {answers.budgetRange ? answers.budgetRange.replace("_", " ") : "Flexible"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                      {isAr ? "الخدمات" : "Services"}
                    </span>
                    <span className="font-semibold text-primary">
                      {answers.requiredServices.length > 0
                        ? `${answers.requiredServices.length} ${isAr ? "خدمات" : "services"}`
                        : isAr ? "استشارة عامة" : "Full Scope"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation Error Message */}
        {validationError && (
          <p className="text-xs text-rose-500 font-semibold mt-4 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-rose-500" />
            {validationError}
          </p>
        )}

        {/* Bottom Consultation Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border gap-3">
          <SADAButton
            variant="outline"
            onClick={handleBack}
            className="gap-2 text-xs sm:text-sm min-h-[44px] px-5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="size-4 rtl:rotate-180 shrink-0" />
            <span className="whitespace-nowrap">{isAr ? "رجوع" : "Back"}</span>
          </SADAButton>

          <SADAButton
            variant="primary"
            onClick={handleNext}
            className="gap-2 font-semibold text-xs sm:text-sm min-h-[44px] px-6 whitespace-nowrap shrink-0"
          >
            {currentStep === totalSteps ? (
              <>
                <span className="whitespace-nowrap">{isAr ? "استخراج الباقة الموصى بها" : "Show Best Fit Recommendation"}</span>
                <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
              </>
            ) : (
              <>
                <span className="whitespace-nowrap">{isAr ? "متابعة" : "Continue"}</span>
                <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
              </>
            )}
          </SADAButton>
        </div>
      </SADACard>
    </div>
  );
}
