import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import {
  TIMELINE_OPTIONS,
  BUDGET_PREFERENCE_OPTIONS,
  BUDGET_RANGES,
  PREFERRED_CONTACTS,
  DiscoveryAnswers,
  getLocalizedDiscoveryOption,
} from "./discovery-utils";
import { SADASelect } from "@/components/ui/sada-select";
import { useI18n } from "@/i18n";

interface Props {
  initialAnswers: Partial<DiscoveryAnswers>;
  onComplete: (answers: DiscoveryAnswers) => void;
  onBackToSelection: () => void;
}

export function FreeTextDiscovery({ initialAnswers, onComplete, onBackToSelection }: Props) {
  const { t, isRTL, language } = useI18n();
  const isAr = language === "ar";
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [rawDescription, setRawDescription] = useState(initialAnswers.raw_description || "");
  const [company, setCompany] = useState(initialAnswers.company || "");
  const [timeline, setTimeline] = useState(initialAnswers.timeline || "This month");
  const [budgetPref, setBudgetPref] = useState(initialAnswers.budget_preference || "Flexible");
  const [budgetRange, setBudgetRange] = useState(initialAnswers.budget_range || "");

  // Contact state
  const [name, setName] = useState(initialAnswers.name || "");
  const [email, setEmail] = useState(initialAnswers.email || "");
  const [phone, setPhone] = useState(initialAnswers.phone || "");
  const [preferredContact, setPreferredContact] = useState<"WhatsApp" | "Phone" | "Email">(
    initialAnswers.preferred_contact || "WhatsApp"
  );

  const handleNext = () => {
    setError(null);

    if (step === 1) {
      if (!rawDescription.trim() || rawDescription.trim().length < 15) {
        setError(
          isAr
            ? "يرجى وصف مشروعك أو وضعك الحالي (15 حرفاً على الأقل)."
            : "Please describe your project or situation (at least 15 characters)."
        );
        return;
      }
    }

    if (step === 2) {
      if (!name.trim() || name.trim().length < 2) {
        setError(isAr ? "يرجى كتابة اسمك." : "Please provide your name.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setError(isAr ? "يرجى إدخال عنوان بريد إلكتروني صالح." : "Please provide a valid email address.");
        return;
      }

      const payload: DiscoveryAnswers = {
        path_taken: "free_text",
        raw_description: rawDescription.trim(),
        company: company.trim() || undefined,
        timeline,
        budget_preference: budgetPref,
        budget_range: budgetPref === "I have a budget" ? budgetRange : undefined,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        preferred_contact: preferredContact,
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
            <MessageSquareText className="size-3.5" />
            {isAr ? "موجز حر للمشروع" : "DIRECT SITUATION BRIEF"}
          </span>
          <span>{isAr ? `الخطوة ${step} من ٢` : `Step ${step} of 2`}</span>
        </div>
        <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary rounded-full"
            initial={false}
            animate={{ width: `${(step / 2) * 100}%` }}
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
          {/* STEP 1: FREE TEXT DESCRIPTION */}
          {step === 1 && (
            <motion.div
              key="free-step1"
              initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {isAr ? "الخطوة ١" : "Step 1"}
                </p>
                <h2 className="font-display text-2xl font-bold">
                  {isAr ? "اشرح مشروعك ووضعك الحالي بحرية" : "Describe your project & situation"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "أخبرنا أين أنت الآن، وما الذي لا يعمل كما يجب، وإلى أين تريد الوصول. سنحدد ما تحتاجه بدقة."
                    : "Tell us where you are, what's not working, and where you want to go. We'll figure out what you need from there."}
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={7}
                  placeholder={
                    isAr
                      ? "أخبرنا عن عملك، والتحديات الحالية، وما جربته سابقاً، وكيف تبدو النتيجة المثالية بالنسبة لك..."
                      : "Tell us about your business, the current challenges, what you've tried, and what an ideal outcome looks like for you..."
                  }
                  value={rawDescription}
                  onChange={(e) => setRawDescription(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-2xl p-4 text-sm resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none leading-relaxed"
                  autoFocus
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {isAr ? "اسم الشركة / العلامة التجارية (اختياري)" : "Company / Brand Name (Optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder={isAr ? "مثال: صدى الرقمية" : "e.g. SADA Digital"}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {isAr ? "الموعد المستهدف" : "Desired Timeline"}
                  </label>
                  <SADASelect
                    value={timeline}
                    onChange={setTimeline}
                    options={TIMELINE_OPTIONS.map((t) => ({
                      value: t,
                      label: getLocalizedDiscoveryOption(t, language),
                    }))}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: BUDGET & CONTACT */}
          {step === 2 && (
            <motion.div
              key="free-step2"
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
                  {isAr ? "الميزانية وبيانات التواصل" : "Budget & Contact Details"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr ? "لنتمكن من توجيه ردنا وتشخيصنا إليك." : "So we know who to address our response to."}
                </p>
              </div>

              {/* Budget options */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  {isAr ? "إطار الميزانية" : "Budget Parameters"}
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
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/50">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "الاسم بالكامل" : "Full Name"} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "اسمك الكريم" : "Your name"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    placeholder="your@email.com"
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

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {isAr ? "طريقة التواصل المفضلة" : "Preferred Contact Channel"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {PREFERRED_CONTACTS.map((ch) => {
                      const selected = preferredContact === ch;
                      const label = ch === "WhatsApp" && isAr ? "واتساب" : ch === "Phone" && isAr ? "هاتف" : ch === "Email" && isAr ? "بريد إلكتروني" : ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setPreferredContact(ch)}
                          className={`p-2 rounded-xl border text-center text-xs font-medium transition-all ${
                            selected
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary font-semibold"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
            {step === 2
              ? (isAr ? "إرسال تفاصيل المشروع" : "Send Description")
              : (isAr ? "متابعة" : "Continue")}
          </span>
          <ArrowRight className="size-4 rtl-flip" />
        </button>
      </div>
    </div>
  );
}
