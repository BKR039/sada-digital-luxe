// ============================================================
// SADA OS — SMART MATCHER: CONTACT DETAILS FORM (STRATEGIC INTAKE)
// High-converting, executive intake form with selected package snapshot & FCC typography
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Sparkles,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { SADAButton, SADAInput, SADATextarea, SADABadge, SADACard } from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { useTranslation } from "@/i18n";
import type { ContactDetails, PackageRecommendation } from "@/types/smart-match";

interface ContactDetailsFormProps {
  initialValues?: Partial<ContactDetails>;
  selectedPackage: PackageRecommendation | null;
  onSubmit: (details: ContactDetails) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function ContactDetailsForm({
  initialValues,
  selectedPackage,
  onSubmit,
  onBack,
  isSubmitting,
}: ContactDetailsFormProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [fullName, setFullName] = useState(initialValues?.fullName || "");
  const [businessName, setBusinessName] = useState(initialValues?.businessName || "");
  const [phone, setPhone] = useState(initialValues?.phone || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const [city, setCity] = useState(initialValues?.city || "");
  const [additionalMessage, setAdditionalMessage] = useState(initialValues?.additionalMessage || "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = isAr ? "يرجى إدخال اسمك الكريم" : "Please enter your full name.";
    }

    if (!businessName.trim()) {
      errs.businessName = isAr ? "يرجى إدخال اسم النشاط التجاري" : "Please enter your business name.";
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = isAr ? "يرجى إدخال بريد إلكتروني صالح للتواصل" : "Enter a valid email address.";
    }

    if (!phone.trim() || phone.replace(/\D/g, "").length < 8) {
      errs.phone = isAr ? "يرجى التحقق من رقم الهاتف / واتساب والمحاولة مجدداً" : "Please provide a valid phone or WhatsApp number.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim() || undefined,
      additionalMessage: additionalMessage.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* 21. SELECTED PACKAGE REASSURANCE PILL AT TOP */}
      {selectedPackage ? (
        <div className="p-4 sm:p-5 rounded-2xl border border-primary/30 bg-primary/[0.05] backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
                {isAr ? "الباقة المختارة لطلبك" : "YOUR RECOMMENDATION"}
              </div>
              <div className="font-extrabold text-foreground text-base sm:text-lg font-display">
                {isAr ? (selectedPackage.packageNameAr || selectedPackage.packageName) : selectedPackage.packageName}
              </div>
            </div>
          </div>

          <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-border/60 pt-2 sm:pt-0">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              <SADANumber variant="percent" value={selectedPackage.score} /> {isAr ? "توافق" : "Match"}
            </span>
            {selectedPackage.packagePrice > 0 ? (
              <div className="flex items-baseline gap-1 mt-0.5">
                <SADANumber
                  variant="metric"
                  value={selectedPackage.packagePrice}
                  currency={selectedPackage.currency || "TND"}
                  className="text-sm font-bold text-foreground"
                />
                <span className="text-[11px] text-muted-foreground font-sans">
                  / {selectedPackage.billingType === "monthly" ? (isAr ? "شهر" : "month") : (isAr ? "مرة واحدة" : "one-time")}
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-primary">{isAr ? "تسعير مخصص" : "Custom Scope"}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
            {isAr ? "استشارة مخصصة" : "CUSTOM STRATEGIC CONSULTATION"}
          </div>
          <div className="font-bold text-foreground text-sm mt-0.5">
            {isAr ? "طلب دراسة متطلبات المشروع مع الفريق الاستراتيجي لصدى" : "Custom Strategy & Package Assessment with SADA Team"}
          </div>
        </div>
      )}

      {/* 20. CONTACT FORM CARD */}
      <SADACard className="p-6 sm:p-9 space-y-6 border-border bg-card/85 backdrop-blur-sm shadow-xl">
        <div className="space-y-1.5 border-b border-border/80 pb-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-foreground tracking-tight">
            {isAr ? "فلنجعل هذا واقعاً." : "Let’s make this real."}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isAr
              ? "توصيتك جاهزة. شاركنا بضعة تفاصيل أساسية وسيقوم فريق صدى الاستراتيجي بمراجعة متطلباتك والرد خلال 24 ساعة."
              : "Your recommendation is ready. Give us a few details and the SADA team will review your brief."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                {isAr ? "الاسم الكامل *" : "Full Name *"}
              </label>
              <SADAInput
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                }}
                placeholder={isAr ? "مثال: مريم بن سالم" : "e.g. Sarah Smith"}
                className={`min-h-[44px] text-xs sm:text-sm ${errors.fullName ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                disabled={isSubmitting}
              />
              {errors.fullName && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.fullName}</p>
              )}
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" />
                {isAr ? "اسم النشاط التجاري *" : "Business Name *"}
              </label>
              <SADAInput
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (errors.businessName) setErrors((prev) => ({ ...prev, businessName: "" }));
                }}
                placeholder={isAr ? "مثال: دار الزيتونة" : "e.g. Maison Fleurie"}
                className={`min-h-[44px] text-xs sm:text-sm ${errors.businessName ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                disabled={isSubmitting}
              />
              {errors.businessName && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.businessName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" />
                {isAr ? "رقم الهاتف / واتساب *" : "Phone / WhatsApp *"}
              </label>
              <SADAInput
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                }}
                placeholder={isAr ? "مثال: 98 123 456 (+216)" : "e.g. +216 98 123 456"}
                className={`min-h-[44px] text-xs sm:text-sm ${errors.phone ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                disabled={isSubmitting}
              />
              {errors.phone && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                {isAr ? "البريد الإلكتروني *" : "Email Address *"}
              </label>
              <SADAInput
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
                placeholder={isAr ? "contact@company.tn" : "contact@company.com"}
                className={`min-h-[44px] text-xs sm:text-sm ${errors.email ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.email}</p>
              )}
            </div>
          </div>

          {/* City / Location (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              {isAr ? "المدينة / المقر (اختياري)" : "City / Location (Optional)"}
            </label>
            <SADAInput
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={isAr ? "مثال: تونس العاصمة، سوسة، صفاقس..." : "e.g. Tunis, Sousse, Sfax, International..."}
              className="min-h-[44px] text-xs sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          {/* Additional Notes (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground font-mono mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              {isAr ? "ملاحظات أو أسئلة إضافية (اختياري)" : "Additional Notes or Specific Requests (Optional)"}
            </label>
            <SADATextarea
              rows={3}
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              placeholder={
                isAr
                  ? "شاركنا أي تفاصيل عن علامتك، روابط حساباتك، أو استفسارات خاصة ترغب في مناقشتها..."
                  : "Share your social handles, timeline expectations, or any specific questions..."
              }
              className="text-xs sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          {/* SLA & Confidentiality Guarantees */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>
                {isAr
                  ? "بياناتك محمية بسرية تامة ولا تُشارك مع أي طرف ثالث."
                  : "Strictly confidential under SADA professional privacy standards."}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-primary shrink-0 font-mono">
              <Clock className="size-3.5" />
              <span>{isAr ? "الرد خلال 24 ساعة" : "24h Response SLA"}</span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-5 border-t border-border">
            <SADAButton
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
              className="gap-2 min-h-[44px] px-5 text-xs sm:text-sm whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" />
              {isAr ? "رجوع" : "Back"}
            </SADAButton>

            <SADAButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-2 font-bold min-h-[44px] px-7 text-xs sm:text-sm shadow-lg whitespace-nowrap shrink-0"
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 shrink-0 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isAr ? "جاري الإرسال..." : "Submitting brief..."}
                </>
              ) : (
                <>
                  {isAr ? "تأكيد وإرسال الطلب" : "Confirm & Send Request"}
                  <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
                </>
              )}
            </SADAButton>
          </div>
        </form>
      </SADACard>
    </motion.div>
  );
}
