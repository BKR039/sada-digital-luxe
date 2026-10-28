import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles, HelpCircle } from "lucide-react";
import {
  BUSINESS_TYPES,
  BUSINESS_STAGES,
  INDUSTRY_QUESTIONS,
  WHAT_BROUGHT_OPTIONS,
  MAIN_PROBLEM_OPTIONS,
  getRootProblemBranch,
  WHAT_TRIED_OPTIONS,
  SADA_SERVICES,
  TIMELINE_OPTIONS,
  BUDGET_PREFERENCE_OPTIONS,
  BUDGET_RANGES,
  PREFERRED_CONTACTS,
  DiscoveryAnswers,
  getLocalizedDiscoveryOption,
  ROOT_QUESTIONS_AR,
} from "./discovery-utils";
import { useI18n } from "@/i18n";

const INDUSTRY_QUESTIONS_AR: Record<string, { question: string; placeholder: string }> = {
  "E-commerce": {
    question: "ماذا تبيع حالياً وأين يشتري منك العملاء؟",
    placeholder: "مثال: أزياء فاخرة عبر شوبيفاي وإنستغرام، مع الشحن لكافة المدن...",
  },
  "Restaurant / Café": {
    question: "كيف يكتشفك العملاء ويطلبون منك حالياً؟",
    placeholder: "مثال: التواجد المباشر وتطبيقات التوصيل، حساب إنستغرام يحتاج تطويراً...",
  },
  "Travel & Tourism": {
    question: "ما هي أبرز خدماتك ووجهاتك السياحية؟",
    placeholder: "مثال: جولات سياحية فاخرة، برامج مخصصة، وشراكات فندقية راقية...",
  },
  "Technology / SaaS": {
    question: "ما الذي تقوم ببنائه ومن هو المستخدم المستهدف؟",
    placeholder: "مثال: منصة سحابية لأتمتة أعمال فرق الدعم اللوجستي في المنطقة...",
  },
  "Real Estate": {
    question: "ما هي نوعية العقارات أو العملاء المستهدفين؟",
    placeholder: "مثال: فلل سكنية فاخرة ومساحات تجارية للمستثمرين...",
  },
  "Healthcare": {
    question: "ما هي التخصصات أو الخدمات الطبية التي تقدمها؟",
    placeholder: "مثال: مجمع أسنان متكامل مع التوسع في طب الأسنان التجميلي...",
  },
  "Education": {
    question: "ما هي البرامج أو الدورات التدريبية المقدمة؟",
    placeholder: "مثال: أكاديمية تدريب مهني مع دورات حضورية وعبر الإنترنت...",
  },
  "B2B / Company": {
    question: "ما هي المنتجات أو الخدمات المؤسسية التي توفرها؟",
    placeholder: "مثال: حلول توريد وتغليف للمصانع والشركات الكبرى...",
  },
  "Professional Services": {
    question: "ما هو مجال استشاراتك أو خدماتك المتخصصة؟",
    placeholder: "مثال: شركة استشارات مالية وتدقيق حسابات للمؤسسات...",
  },
  "Personal Brand / Creator": {
    question: "ما هو تخصصك ومن هو جمهورك الأساسي؟",
    placeholder: "مثال: مدرب قيادي تنفيذي يقدم برامج إرشادية للنخبة...",
  },
  Other: {
    question: "اشرح خدماتك الأساسية والجمهور الذي تستهدفه.",
    placeholder: "مثال: نصمم وننتج أثاثاً حرفياً فاخراً للمصممين والمشاريع الراقية...",
  },
};

interface Props {
  initialAnswers: Partial<DiscoveryAnswers>;
  onComplete: (answers: DiscoveryAnswers) => void;
  onSwitchToFreeText: () => void;
}

export function GuidedDiscovery({ initialAnswers, onComplete, onSwitchToFreeText }: Props) {
  const { t, isRTL, language } = useI18n();
  const isAr = language === "ar";
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessType, setBusinessType] = useState<string>(initialAnswers.business_type || "");
  const [businessTypeCustom, setBusinessTypeCustom] = useState(initialAnswers.business_type_custom || "");
  const [businessStage, setBusinessStage] = useState<string>(initialAnswers.business_stage || "");
  const [situationDetails, setSituationDetails] = useState(initialAnswers.business_situation_details || "");
  const [whatBrought, setWhatBrought] = useState<string[]>(initialAnswers.what_brought_here || []);
  const [whatBroughtCustom, setWhatBroughtCustom] = useState(initialAnswers.what_brought_here_custom || "");
  const [mainProblem, setMainProblem] = useState<string>(initialAnswers.main_problem || "");
  const [mainProblemCustom, setMainProblemCustom] = useState(initialAnswers.main_problem_custom || "");
  const [rootProblem, setRootProblem] = useState<string>(initialAnswers.root_problem || "");
  const [rootProblemCustom, setRootProblemCustom] = useState(initialAnswers.root_problem_custom || "");
  const [whatTried, setWhatTried] = useState<string[]>(initialAnswers.what_tried || []);
  const [whatTriedNotes, setWhatTriedNotes] = useState(initialAnswers.what_tried_notes || "");
  const [servicesNeeded, setServicesNeeded] = useState<string[]>(initialAnswers.services_needed || []);
  const [priorityService, setPriorityService] = useState<string>(initialAnswers.priority_service || "");
  const [timeline, setTimeline] = useState<string>(initialAnswers.timeline || "");
  const [budgetPref, setBudgetPref] = useState<string>(initialAnswers.budget_preference || "");
  const [budgetRange, setBudgetRange] = useState<string>(initialAnswers.budget_range || "");

  // Contact state
  const [name, setName] = useState(initialAnswers.name || "");
  const [company, setCompany] = useState(initialAnswers.company || "");
  const [email, setEmail] = useState(initialAnswers.email || "");
  const [phone, setPhone] = useState(initialAnswers.phone || "");
  const [preferredContact, setPreferredContact] = useState<"WhatsApp" | "Phone" | "Email">(
    initialAnswers.preferred_contact || "WhatsApp"
  );
  const [additionalNotes, setAdditionalNotes] = useState(initialAnswers.additional_notes || "");

  // Dynamic root branch
  const rootBranch = getRootProblemBranch(mainProblem, whatBrought);

  // Calculate whether Step 8 (Priority) should be shown
  const showPriorityStep = servicesNeeded.length > 1 && !servicesNeeded.includes("Not sure — recommend what we need");

  // Unified sequence of active user-facing steps
  const activeSteps = [
    1, // Business type
    2, // Business stage & context
    3, // Challenges
    4, // Desired outcome / Goal
    5, // Root challenge
    6, // Past experience
    7, // Services needed
    ...(showPriorityStep ? [8] : []), // Priority service (if multiple chosen)
    9, // Timeline
    10, // Budget
    11, // Contact details
  ];

  const totalSteps = activeSteps.length;
  const currentDisplayStep = Math.max(1, activeSteps.indexOf(step) + 1);

  const handleNext = () => {
    setError(null);

    // Validation per step
    if (step === 1) {
      if (!businessType) {
        setError(isAr ? "يرجى تحديد نوع نشاطك التجاري للمتابعة." : "Please select your business type to proceed.");
        return;
      }
      if (businessType === "Other" && !businessTypeCustom.trim()) {
        setError(isAr ? "يرجى تحديد طبيعة النشاط التجاري." : "Please specify your business type.");
        return;
      }
    }

    if (step === 2) {
      if (!businessStage) {
        setError(isAr ? "يرجى تحديد المرحلة الحالية لمشروعك." : "Please select where your business is right now.");
        return;
      }
    }

    if (step === 3) {
      if (whatBrought.length === 0 && !whatBroughtCustom.trim()) {
        setError(isAr ? "يرجى اختيار تحدٍ واحد على الأقل أو كتابة ما يحدث." : "Please select at least one challenge or describe what's happening.");
        return;
      }
    }

    if (step === 4) {
      if (!mainProblem) {
        setError(isAr ? "يرجى اختيار الهدف الأهم الذي ترغب بحله." : "Please select the main thing you would like to fix.");
        return;
      }
      if (mainProblem === "Other" && !mainProblemCustom.trim()) {
        setError(isAr ? "يرجى وصف المشكلة المحددة." : "Please describe the specific issue.");
        return;
      }
    }

    if (step === 5) {
      if (!rootProblem && !rootProblemCustom.trim()) {
        setError(isAr ? "يرجى اختيار خيار أو توضيح التحدي الجذري." : "Please select an option or specify your root challenge.");
        return;
      }
    }

    // Step 6 (What have you tried) is optional per prompt specs

    if (step === 7) {
      if (servicesNeeded.length === 0) {
        setError(isAr ? "يرجى اختيار خدمة واحدة على الأقل أو 'لست متأكداً'." : "Please select at least one service or 'Not sure'.");
        return;
      }
      // If only 1 service selected, auto-set priority and skip Step 8
      if (!showPriorityStep) {
        setPriorityService(servicesNeeded[0] || "");
        setStep(9);
        return;
      }
    }

    if (step === 8) {
      if (!priorityService && showPriorityStep) {
        setError(isAr ? "يرجى تحديد أولويتك الأولى." : "Please select your primary priority.");
        return;
      }
    }

    if (step === 9) {
      if (!timeline) {
        setError(isAr ? "يرجى تحديد الإطار الزمني للبدء." : "Please select your desired start timeline.");
        return;
      }
    }

    if (step === 10) {
      if (!budgetPref) {
        setError(isAr ? "يرجى توضيح تفضيلك بشأن الميزانية." : "Please indicate your budget preference.");
        return;
      }
      if (budgetPref === "I have a budget" && !budgetRange) {
        setError(isAr ? "يرجى تحديد النطاق التقريبي للميزانية." : "Please select your approximate budget range.");
        return;
      }
    }

    if (step === 11) {
      if (!name.trim() || name.trim().length < 2) {
        setError(isAr ? "يرجى كتابة اسمك بالكامل (حرفين على الأقل)." : "Please provide your full name (minimum 2 characters).");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setError(isAr ? "يرجى إدخال عنوان بريد إلكتروني صالح." : "Please provide a valid email address.");
        return;
      }

      // Complete!
      const payload: DiscoveryAnswers = {
        path_taken: "guided",
        business_type: businessType === "Other" ? businessTypeCustom.trim() : businessType,
        business_type_custom: businessType === "Other" ? businessTypeCustom.trim() : undefined,
        business_stage: businessStage,
        business_situation_details: situationDetails.trim() || undefined,
        what_brought_here: whatBrought,
        what_brought_here_custom: whatBroughtCustom.trim() || undefined,
        main_problem: mainProblem === "Other" ? mainProblemCustom.trim() : mainProblem,
        main_problem_custom: mainProblem === "Other" ? mainProblemCustom.trim() : undefined,
        root_problem: rootProblem === "Other" ? rootProblemCustom.trim() : rootProblem,
        root_problem_custom: rootProblem === "Other" ? rootProblemCustom.trim() : undefined,
        what_tried: whatTried,
        what_tried_notes: whatTriedNotes.trim() || undefined,
        services_needed: servicesNeeded,
        priority_service: priorityService || undefined,
        timeline,
        budget_preference: budgetPref,
        budget_range: budgetPref === "I have a budget" ? budgetRange : undefined,
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        preferred_contact: preferredContact,
        additional_notes: additionalNotes.trim() || undefined,
      };

      onComplete(payload);
      return;
    }

    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    if (step === 9 && !showPriorityStep) {
      setStep(7);
      return;
    }
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const toggleMultiSelect = (item: string, currentList: string[], setList: (v: string[]) => void) => {
    if (currentList.includes(item)) {
      setList(currentList.filter((i) => i !== item));
    } else {
      setList([...currentList, item]);
    }
  };

  const currentIndustryConfig = isAr
    ? INDUSTRY_QUESTIONS_AR[businessType] || INDUSTRY_QUESTIONS_AR["Other"]
    : INDUSTRY_QUESTIONS[businessType] || INDUSTRY_QUESTIONS["Other"];

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 text-primary font-semibold">
            <Sparkles className="size-3.5" />
            {isAr ? "الاستكشاف الإرشادي المباشر" : "GUIDED DISCOVERY"}
          </span>
          <span>
            {isAr ? `الخطوة ${currentDisplayStep} من ${totalSteps}` : `Step ${currentDisplayStep} of ${totalSteps}`}
          </span>
        </div>
        <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary rounded-full"
            initial={false}
            animate={{ width: `${(currentDisplayStep / totalSteps) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center justify-between"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline ms-2">
            {isAr ? "إغلاق" : "Dismiss"}
          </button>
        </motion.div>
      )}

      {/* Step Contents */}
      <div className="min-h-[380px]">
        <AnimatePresence mode="wait">
          {/* STEP 1: BUSINESS TYPE */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 1" : "Step 1"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هو نوع نشاطك التجاري؟" : "What type of business are you?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "يساعدنا ذلك في طرح الأسئلة المناسبة لنموذج عملك بدقة."
                    : "This helps us ask the right questions for your model."}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {BUSINESS_TYPES.map((b) => {
                  const selected = businessType === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBusinessType(b)}
                      className={`p-3.5 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(b, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {businessType === "Other" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <input
                    type="text"
                    placeholder={isAr ? "حدد طبيعة نشاطك أو مجالك..." : "Specify your business or industry..."}
                    value={businessTypeCustom}
                    onChange={(e) => setBusinessTypeCustom(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-start"
                    autoFocus
                  />
                </motion.div>
              )}

              {/* Free text escape */}
              <div className="pt-3 flex items-center justify-between border-t border-border/50 text-xs">
                <span className="text-muted-foreground">
                  {isAr ? "لا تجد ما يصف مشروعك بدقة؟" : "Don't fit into these boxes?"}
                </span>
                <button
                  type="button"
                  onClick={onSwitchToFreeText}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>{isAr ? "تفضل شرح فكرتك بحرية تامة؟" : "Prefer to just explain it freely?"}</span>
                  <span className="rtl-flip">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: CURRENT SITUATION & ADAPTIVE INDUSTRY QUESTION */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 2" : "Step 2"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "أين يقف مشروعك اليوم؟" : "Where is your business right now?"}
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BUSINESS_STAGES.map((s) => {
                  const selected = businessStage === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBusinessStage(s)}
                      className={`p-3.5 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(s, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Adaptive Industry-Specific Question */}
              <div className="pt-3 border-t border-border/60 space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  {currentIndustryConfig.question}
                </label>
                <textarea
                  rows={3}
                  value={situationDetails}
                  onChange={(e) => setSituationDetails(e.target.value)}
                  placeholder={currentIndustryConfig.placeholder}
                  className="w-full bg-transparent border border-border rounded-xl p-3.5 text-sm resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-start"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 3: WHAT BROUGHT YOU HERE */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 3" : "Step 3"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هي التحديات التي تواجهك حالياً؟" : "What's happening right now?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "اختر جميع التحديات أو الأعراض التي تنطبق على مشروعك الآن."
                    : "Select all symptoms that currently apply to your business."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {WHAT_BROUGHT_OPTIONS.map((opt) => {
                  const selected = whatBrought.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMultiSelect(opt, whatBrought, setWhatBrought)}
                      className={`p-3 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(opt, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {whatBrought.includes("Other") && (
                <input
                  type="text"
                  placeholder={isAr ? "صف الظروف أو التحديات الأخرى..." : "Describe other circumstance..."}
                  value={whatBroughtCustom}
                  onChange={(e) => setWhatBroughtCustom(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none text-start"
                />
              )}
            </motion.div>
          )}

          {/* STEP 4: MAIN PROBLEM */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 4" : "Step 4"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "لو استطعنا حل أمر واحد جوهري، ماذا سيكون؟" : "If we could fix ONE thing, what should it be?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "الهدف التجاري أو الاستثماري الأهم بالنسبة لك في هذه المرحلة."
                    : "Your single most important business objective right now."}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MAIN_PROBLEM_OPTIONS.map((p) => {
                  const selected = mainProblem === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMainProblem(p)}
                      className={`p-3.5 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(p, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {mainProblem === "Other" && (
                <input
                  type="text"
                  placeholder={isAr ? "ما هو ذلك الحل أو الهدف المنشود؟" : "What is that single fix?"}
                  value={mainProblemCustom}
                  onChange={(e) => setMainProblemCustom(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none text-start"
                  autoFocus
                />
              )}
            </motion.div>
          )}

          {/* STEP 5: ROOT PROBLEM (BRANCHING) */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 5" : "Step 5"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? (ROOT_QUESTIONS_AR[rootBranch.question] || rootBranch.question) : rootBranch.question}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "التعمق في السبب الحقيقي الذي يعيق تقدمك أو انطلاقك."
                    : "Digging into what's actually holding you back."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rootBranch.options.map((opt) => {
                  const selected = rootProblem === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRootProblem(opt)}
                      className={`p-3.5 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(opt, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {rootProblem === "Other" && (
                <input
                  type="text"
                  placeholder={isAr ? "اشرح السبب الجذري بالتفصيل..." : "Explain the specific root cause..."}
                  value={rootProblemCustom}
                  onChange={(e) => setRootProblemCustom(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none text-start"
                  autoFocus
                />
              )}
            </motion.div>
          )}

          {/* STEP 6: WHAT HAVE YOU TRIED? */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 6 (اختياري)" : "Step 6 (Optional)"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هي التجارب التي خضتها سابقاً؟" : "What have you already tried?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "لتجنب اقتراح ما لم ينجح معك مسبقاً أو تكرار نفس المحاولات."
                    : "So we avoid recommending things that failed or repeating past work."}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {WHAT_TRIED_OPTIONS.map((t) => {
                  const selected = whatTried.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleMultiSelect(t, whatTried, setWhatTried)}
                      className={`p-3 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(t, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <textarea
                  rows={2}
                  placeholder={
                    isAr
                      ? "أي تفاصيل حول ما نجح أو واجه صعوبات؟ (اختياري)"
                      : "Any details on what worked or didn't? (optional)"
                  }
                  value={whatTriedNotes}
                  onChange={(e) => setWhatTriedNotes(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl p-3 text-xs sm:text-sm resize-none focus:border-primary outline-none text-start"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 7: WHAT DO YOU NEED FROM SADA? */}
          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 7" : "Step 7"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هي المجالات التي ترغب أن تبدع صدى في تنفيذها لك؟" : "What would you like SADA to help with?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "اختر كافة الخدمات المطلوبة من قطاعاتنا الإبداعية والتقنية."
                    : "Select all relevant services from our core divisions."}
                </p>
              </div>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {SADA_SERVICES.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {getLocalizedDiscoveryOption(cat.name, language)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {cat.services.map((srv) => {
                        const selected = servicesNeeded.includes(srv);
                        return (
                          <button
                            key={srv}
                            type="button"
                            onClick={() => {
                              // If selecting a service, remove "Not sure"
                              if (servicesNeeded.includes("Not sure — recommend what we need")) {
                                setServicesNeeded([srv]);
                              } else {
                                toggleMultiSelect(srv, servicesNeeded, setServicesNeeded);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-start text-xs font-medium transition-all ${
                              selected
                                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{getLocalizedDiscoveryOption(srv, language)}</span>
                              {selected && <Check className="size-3 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Not sure option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setServicesNeeded(["Not sure — recommend what we need"]);
                      setPriorityService("");
                    }}
                    className={`w-full p-3 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                      servicesNeeded.includes("Not sure — recommend what we need")
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border bg-card/60 hover:bg-card text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="size-4 text-primary shrink-0" />
                      <span>
                        {isAr
                          ? "غير متأكد — اقترحوا علينا الأنسب بناءً على دراسة حالتنا"
                          : "Not sure — recommend what we need based on our situation"}
                      </span>
                    </span>
                    {servicesNeeded.includes("Not sure — recommend what we need") && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 8: PRIORITY (ONLY IF MULTIPLE SERVICES) */}
          {step === 8 && showPriorityStep && (
            <motion.div
              key="step8"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة 8" : "Step 8"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هو العنصر الأكثر إلحاحاً وأولوية للبدء به أولاً؟" : "What's the most important thing to solve first?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "لقد اخترت عدة خدمات. حدد أولويتك القصوى الفورية رقم 1."
                    : "You selected multiple areas. Pick your #1 immediate priority."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {servicesNeeded.map((srv) => {
                  const selected = priorityService === srv;
                  return (
                    <button
                      key={srv}
                      type="button"
                      onClick={() => setPriorityService(srv)}
                      className={`p-3.5 rounded-xl border text-start text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(srv, language)}</span>
                        {selected && <Check className="size-4 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 9: TIMELINE */}
          {step === 9 && (
            <motion.div
              key="step9"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? `الخطوة ${currentDisplayStep}` : `Step ${currentDisplayStep}`}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "متى ترغب في تدشين العمل والبدء؟" : "When would you like to start?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "يساعدنا في حجز الطاقة الإنتاجية والتقنية لفريقنا المتخصص."
                    : "This helps us schedule creative and technical capacity."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TIMELINE_OPTIONS.map((t) => {
                  const selected = timeline === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeline(t)}
                      className={`p-3.5 rounded-xl border text-start text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(t, language)}</span>
                        {selected && <Check className="size-4 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 10: BUDGET */}
          {step === 10 && (
            <motion.div
              key="step10"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? `الخطوة ${currentDisplayStep}` : `Step ${currentDisplayStep}`}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "هل لديك ميزانية تقديرية محددة في ذهنك؟" : "Do you already have a budget in mind?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "نكيف نطاق العمل وفق معاييرك الاستثمارية بدقة، ولا نقترح نطاقاً فائضاً عن حاجتك."
                    : "We adapt our approach to your parameters. We never push unnecessary scope."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {BUDGET_PREFERENCE_OPTIONS.map((b) => {
                  const selected = budgetPref === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBudgetPref(b)}
                      className={`p-3.5 rounded-xl border text-start text-xs sm:text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-card hover:border-foreground/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{getLocalizedDiscoveryOption(b, language)}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {budgetPref === "I have a budget" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pt-2 border-t border-border/50"
                >
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {isAr ? "النطاق التقديري للميزانية" : "Approximate Budget Range"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BUDGET_RANGES.map((r) => {
                      const selected = budgetRange === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setBudgetRange(r)}
                          className={`p-3 rounded-xl border text-center text-xs sm:text-sm font-semibold transition-all ${
                            selected
                              ? "border-primary bg-primary/15 text-primary ring-1 ring-primary"
                              : "border-border bg-card hover:border-foreground/20 text-foreground"
                          }`}
                        >
                          <span dir="ltr">{r}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* STEP 11: CONTACT DETAILS */}
          {step === 11 && (
            <motion.div
              key="step11"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "المرحلة الختامية" : "Final Step"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "كيف تفضل أن نتواصل معك؟" : "How should we reach you?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "سنقوم بدراسة موجز مشروعك بدقة والرد عليك خلال 24 ساعة."
                    : "We'll review your discovery brief and respond within 24 hours."}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "الاسم الكامل" : "Full Name"} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "أحمد بن..." : "Ahmed Ben..."}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-start"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "اسم الشركة / العلامة أو المشروع" : "Company / Business Name"}
                  </label>
                  <input
                    type="text"
                    placeholder={isAr ? "اسم العلامة أو المشروع" : "Brand name or Project"}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-start"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "عنوان البريد الإلكتروني" : "Email Address"} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-start"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+216 ... / +..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-start"
                  />
                </div>
              </div>

              {/* Preferred Contact Channel */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "وسيلة التواصل المفضلة" : "Preferred Contact Channel"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PREFERRED_CONTACTS.map((ch) => {
                    const selected = preferredContact === ch;
                    const label = isAr
                      ? ch === "WhatsApp"
                        ? "واتساب"
                        : ch === "Phone"
                        ? "هاتفياً"
                        : "بريد إلكتروني"
                      : ch;
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setPreferredContact(ch)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border bg-card hover:border-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional notes */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "أي معلومات إضافية ترغب في مشاركتها معنا؟ (اختياري)" : "Anything else we should know? (Optional)"}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    isAr
                      ? "سياق إضافي، مراجع خاصة، أو استفسارات معينة..."
                      : "Additional context, specific references, or questions..."
                  }
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl p-3 text-sm resize-none focus:border-primary outline-none text-start"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-4 rtl-flip" />
            <span>{isAr ? "السابق" : "Back"}</span>
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-white text-xs sm:text-sm font-semibold neon-glow hover:scale-[1.02] active:scale-[0.98] transition-transform ms-auto"
        >
          <span>
            {step === 11
              ? isAr
                ? "إرسال موجز المشروع"
                : "Submit Project Brief"
              : isAr
              ? "المتابعة"
              : "Continue"}
          </span>
          <ArrowRight className="size-4 rtl-flip" />
        </button>
      </div>
    </div>
  );
}
