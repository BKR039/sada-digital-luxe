import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Zap } from "lucide-react";
import {
  SADA_SERVICES,
  TIMELINE_OPTIONS,
  BUDGET_PREFERENCE_OPTIONS,
  BUDGET_RANGES,
  PREFERRED_CONTACTS,
  DiscoveryAnswers,
  getLocalizedDiscoveryOption,
} from "./discovery-utils";
import { useI18n } from "@/i18n";

interface Props {
  initialAnswers: Partial<DiscoveryAnswers>;
  onComplete: (answers: DiscoveryAnswers) => void;
  onBackToSelection: () => void;
}

export function QuickDiscovery({ initialAnswers, onComplete, onBackToSelection }: Props) {
  const { t, isRTL, language } = useI18n();
  const isAr = language === "ar";
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [servicesNeeded, setServicesNeeded] = useState<string[]>(initialAnswers.services_needed || []);
  const [priorityService, setPriorityService] = useState<string>(initialAnswers.priority_service || "");
  const [scopeDetails, setScopeDetails] = useState(initialAnswers.raw_description || "");
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

  const toggleService = (srv: string) => {
    if (servicesNeeded.includes(srv)) {
      const next = servicesNeeded.filter((s) => s !== srv);
      setServicesNeeded(next);
      if (priorityService === srv) {
        setPriorityService(next[0] || "");
      }
    } else {
      const next = [...servicesNeeded, srv];
      setServicesNeeded(next);
      if (!priorityService) setPriorityService(srv);
    }
  };

  const handleNext = () => {
    setError(null);

    if (step === 1) {
      if (servicesNeeded.length === 0) {
        setError(isAr ? "يرجى اختيار خدمة واحدة على الأقل." : "Please select at least one service you need.");
        return;
      }
    }

    if (step === 2) {
      if (!timeline) {
        setError(isAr ? "يرجى تحديد الإطار الزمني للبدء." : "Please select your desired start timeline.");
        return;
      }
      if (!budgetPref) {
        setError(isAr ? "يرجى توضيح تفضيلك بشأن الميزانية." : "Please indicate your budget preference.");
        return;
      }
      if (budgetPref === "I have a budget" && !budgetRange) {
        setError(isAr ? "يرجى تحديد النطاق التقريبي للميزانية." : "Please select an approximate budget range.");
        return;
      }
    }

    if (step === 3) {
      if (!name.trim() || name.trim().length < 2) {
        setError(isAr ? "يرجى كتابة اسمك بالكامل." : "Please provide your full name.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setError(isAr ? "يرجى إدخال بريد إلكتروني صالح." : "Please provide a valid email address.");
        return;
      }

      const payload: DiscoveryAnswers = {
        path_taken: "quick",
        services_needed: servicesNeeded,
        priority_service: priorityService || servicesNeeded[0],
        raw_description: scopeDetails.trim() || undefined,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 text-primary font-semibold">
            <Zap className="size-3.5" />
            {isAr ? "طلب سريع" : "QUICK REQUEST"}
          </span>
          <span>{isAr ? `الخطوة ${step} من ٣` : `Step ${step} of 3`}</span>
        </div>
        <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary rounded-full"
            initial={false}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

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

      <div className="min-h-[380px]">
        <AnimatePresence mode="wait">
          {/* STEP 1: SERVICES & PRIORITY */}
          {step === 1 && (
            <motion.div
              key="quick-step1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة ١" : "Step 1"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "ما هي الخدمات التي تحتاجها؟" : "What services do you need?"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "اختر جميع الخدمات والمخرجات المطلوبة لمشروعك."
                    : "Select all deliverables required for your project."}
                </p>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pe-1">
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
                            onClick={() => toggleService(srv)}
                            className={`p-2.5 rounded-xl border text-start text-xs font-medium transition-all ${
                              selected
                                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                : "border-border bg-card/60 hover:bg-card text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{getLocalizedDiscoveryOption(srv, language)}</span>
                              {selected && <Check className="size-3 text-primary shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {servicesNeeded.length > 1 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground block">
                    {isAr ? "المخرج الأعلى أولوية" : "Top Priority Deliverable"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {servicesNeeded.map((srv) => (
                      <button
                        key={srv}
                        type="button"
                        onClick={() => setPriorityService(srv)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          priorityService === srv
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {getLocalizedDiscoveryOption(srv, language)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: SCOPE, TIMELINE & BUDGET */}
          {step === 2 && (
            <motion.div
              key="quick-step2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة ٢" : "Step 2"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "نطاق العمل، الموعد والميزانية" : "Scope, Timeline & Budget"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "قدم سياقاً موجزاً حول المواعيد والمتطلبات الأساسية."
                    : "Provide brief context on deadlines and requirements."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "نطاق المشروع / المتطلبات (اختياري)" : "Project Scope / Requirements (Optional)"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    isAr
                      ? "مثال: نحتاج إلى إعادة تصميم متجر إلكتروني فاخر على شوبيفاي مع فيديو إعلاني للإطلاق..."
                      : "e.g., We need a 5-page luxury e-commerce redesign on Shopify plus a launch reel..."
                  }
                  value={scopeDetails}
                  onChange={(e) => setScopeDetails(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl p-3 text-sm resize-none focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "موعد البدء المستهدف" : "Target Start Date"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {TIMELINE_OPTIONS.map((t) => {
                    const selected = timeline === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimeline(t)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {getLocalizedDiscoveryOption(t, language)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "توقع الميزانية" : "Budget Expectation"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BUDGET_PREFERENCE_OPTIONS.map((b) => {
                    const selected = budgetPref === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBudgetPref(b)}
                        className={`p-2.5 rounded-xl border text-start text-xs font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {getLocalizedDiscoveryOption(b, language)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {budgetPref === "I have a budget" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {BUDGET_RANGES.map((r) => {
                    const selected = budgetRange === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBudgetRange(r)}
                        className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                          selected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card text-foreground hover:border-foreground/20"
                        }`}
                      >
                        <span className="ltr-force">{r}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: CONTACT */}
          {step === 3 && (
            <motion.div
              key="quick-step3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة الأخيرة" : "Final Step"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "بيانات التواصل" : "Contact Details"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "سنراجع نطاق مشروعك ونتواصل معك خلال 24 ساعة."
                    : "We'll review your project scope and get back to you within 24h."}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "الاسم بالكامل" : "Full Name"} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "الاسم بالكامل" : "Full name"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "اسم الشركة / العلامة التجارية" : "Company / Brand Name"}
                  </label>
                  <input
                    type="text"
                    placeholder={isAr ? "اسم الشركة" : "Company name"}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "البريد الإلكتروني" : "Email Address"} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-start"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "الهاتف / الواتساب" : "Phone / WhatsApp"}
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

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "قناة التواصل المفضلة" : "Preferred Contact Channel"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PREFERRED_CONTACTS.map((ch) => {
                    const selected = preferredContact === ch;
                    const label = ch === "WhatsApp" && isAr ? "واتساب" : ch === "Phone" && isAr ? "هاتف" : ch === "Email" && isAr ? "بريد إلكتروني" : ch;
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setPreferredContact(ch)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "ملاحظات إضافية (اختياري)" : "Additional Notes (Optional)"}
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? "أي مواصفات أو تفاصيل أخرى..." : "Any other specifications..."}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl p-3 text-sm resize-none focus:border-primary outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 1) onBackToSelection();
            else setStep((s) => s - 1);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4 rtl-flip" />
          {step === 1 ? (isAr ? "اختيار الأسلوب" : "Choose Path") : (isAr ? "رجوع" : "Back")}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-white text-xs sm:text-sm font-semibold neon-glow hover:scale-[1.02] active:scale-[0.98] transition-transform ms-auto"
        >
          <span>
            {step === 3
              ? (isAr ? "إرسال طلب المشروع" : "Submit Project Request")
              : (isAr ? "متابعة" : "Continue")}
          </span>
          <ArrowRight className="size-4 rtl-flip" />
        </button>
      </div>
    </div>
  );
}
