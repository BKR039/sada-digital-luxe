import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Building2,
  Phone,
  Mail,
  MessageCircle,
  AlertCircle,
  Layers,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicPackages } from "@/lib/package-service";
import type { PackageCatalogItem } from "@/types/package-catalog";
import {
  type PricingPlan,
  type PackageId,
} from "@/data/pricing";
import { BUSINESS_TYPES, getLocalizedDiscoveryOption } from "@/components/discovery/discovery-utils";
import { SADASelect } from "@/components/ui/sada-select";
import { useI18n } from "@/i18n";

function mapCatalogItemToPlan(pkg: PackageCatalogItem, isAr: boolean): PricingPlan {
  const isMonthly = pkg.billing_type === "monthly";
  const unit = isMonthly ? (isAr ? "شهرياً" : "month") : (isAr ? "مشروع" : "project");

  const features: { label: string; included: boolean }[] = [];
  if (pkg.monthly_reels > 0) {
    features.push({ label: isAr ? `${pkg.monthly_reels} ريلز شهرياً` : `${pkg.monthly_reels} Reels / month`, included: true });
  }
  if (pkg.monthly_posts > 0) {
    features.push({ label: isAr ? `${pkg.monthly_posts} منشورات أو كاروسيل شهرياً` : `${pkg.monthly_posts} Posts or Carousels / month`, included: true });
  }
  if (pkg.monthly_stories) {
    features.push({ label: isAr ? (pkg.monthly_stories.includes("Weekly") ? "ستوريز أسبوعية" : pkg.monthly_stories) : pkg.monthly_stories, included: true });
  }
  if (pkg.has_strategy) {
    features.push({ label: isAr ? "تخطيط وجدولة المحتوى الشهري" : "Monthly Content Planning", included: true });
  }
  if (pkg.has_community_management) {
    features.push({ label: isAr ? "إدارة المجتمع والتفاعل (الرد على الرسائل والتعليقات)" : "Community Management (Messages & Comments)", included: true });
  }
  if (pkg.has_ads_management) {
    features.push({ label: isAr ? "إدارة إعلانات ميتا الممولة (Meta Ads)" : "Meta Ads Management", included: true });
  }
  if (pkg.has_website) {
    features.push({ label: isAr ? "موقع إلكتروني احترافي متكامل" : "Professional Website", included: true });
  }

  if (pkg.included_items && pkg.included_items.length > 0) {
    pkg.included_items.forEach((item) => {
      features.push({
        label: isAr ? (item.text_ar || item.text) : item.text,
        included: true,
      });
    });
  }

  if (pkg.excluded_items && pkg.excluded_items.length > 0) {
    pkg.excluded_items.forEach((item) => {
      features.push({
        label: isAr ? (item.text_ar || item.text) : item.text,
        included: false,
      });
    });
  }

  return {
    id: pkg.code.toLowerCase(),
    name: isAr ? (pkg.name_ar || pkg.name) : pkg.name,
    tagline: isAr ? (pkg.short_description_ar || pkg.description_ar || pkg.description || "") : (pkg.short_description || pkg.description || ""),
    price: Number(pkg.price) || 0,
    currency: isAr ? "د.ت" : (pkg.currency || "TND"),
    unit,
    features,
    popular: pkg.badge === "most_popular" || pkg.is_featured,
    cta: isAr ? `انطلق مع ${pkg.name_ar || pkg.name}` : `Start with ${pkg.name}`,
  };
}

export const PACKAGE_PRIORITIES = [
  "Grow on social media",
  "Get more customers",
  "Improve my brand",
  "Run better ads",
  "Build / improve my website",
  "Create better content",
  "Something else",
] as const;

export const PACKAGE_PRIORITIES_AR: Record<string, string> = {
  "Grow on social media": "النمو والانتشار في وسائل التواصل",
  "Get more customers": "جلب المزيد من العملاء والصفقات",
  "Improve my brand": "تطوير هوية ومكانة العلامة التجارية",
  "Run better ads": "إطلاق حملات إعلانية عالية العائد",
  "Build / improve my website": "بناء أو تطوير موقعنا الإلكتروني",
  "Create better content": "إنتاج محتوى إبداعي استثنائي",
  "Something else": "أمر آخر",
};

export type PackagePriority = (typeof PACKAGE_PRIORITIES)[number];

interface PackageConversionFlowProps {
  initialPackageId: PackageId;
  packages?: PackageCatalogItem[];
  plans?: PricingPlan[];
}

export function PackageConversionFlow({
  initialPackageId,
  packages,
  plans,
}: PackageConversionFlowProps) {
  const navigate = useNavigate();
  const { t, isRTL, language } = useI18n();
  const isAr = language === "ar";

  // Dynamic Canonical Package Catalog State
  const initialLivePlans = useMemo(() => {
    if (plans && plans.length > 0) return plans;
    if (packages && packages.length > 0) {
      return packages.map((p) => mapCatalogItemToPlan(p, isAr));
    }
    return [];
  }, [plans, packages, isAr]);

  const [livePlans, setLivePlans] = useState<PricingPlan[]>(initialLivePlans);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(initialLivePlans.length === 0);
  const [selectedPackageId, setSelectedPackageId] = useState<PackageId>(initialPackageId);

  useEffect(() => {
    if (plans && plans.length > 0) {
      setLivePlans(plans);
      setLoadingPlans(false);
      return;
    }
    if (packages && packages.length > 0) {
      setLivePlans(packages.map((p) => mapCatalogItemToPlan(p, isAr)));
      setLoadingPlans(false);
      return;
    }

    let mounted = true;
    setLoadingPlans(true);
    fetchPublicPackages().then((categories) => {
      if (!mounted) return;
      const allPkgs: PackageCatalogItem[] = [];
      for (const cat of categories) {
        if (cat.packages && cat.packages.length > 0) {
          allPkgs.push(...cat.packages);
        }
      }
      if (allPkgs.length > 0) {
        const mapped = allPkgs.map((p) => mapCatalogItemToPlan(p, isAr));
        setLivePlans(mapped);
      }
    }).catch((e) => {
      console.error("[PackageConversionFlow] Failed to load canonical package_catalog:", e);
    }).finally(() => {
      if (mounted) setLoadingPlans(false);
    });
    return () => { mounted = false; };
  }, [isAr, packages, plans]);

  // Resolve canonical plan: dynamic DB values take strict precedence
  const currentPlan: PricingPlan = useMemo(() => {
    if (livePlans.length === 0) return null as any;
    const pool = livePlans;
    const normalized = (selectedPackageId || "").toLowerCase().trim();
    const found = pool.find((p) => p.id === normalized || (p as any).code?.toLowerCase() === normalized);
    if (found) return found;

    if (normalized.startsWith("mg-01") || normalized === "starter") {
      const match = pool.find((p) => p.id === "starter" || p.id === "mg-01" || p.name.toLowerCase().includes("starter"));
      if (match) return match;
    }
    if (normalized.startsWith("mg-02") || normalized.startsWith("mg-03") || normalized === "growth") {
      const match = pool.find((p) => p.id === "growth" || p.id === "mg-02" || p.name.toLowerCase().includes("growth"));
      if (match) return match;
    }
    if (normalized.startsWith("mg-04") || normalized.startsWith("hy-") || normalized.startsWith("pr-") || normalized === "premium") {
      const match = pool.find((p) => p.id === "premium" || p.id === "pr-01" || p.id === "luxe-01" || p.name.toLowerCase().includes("premium") || p.name.toLowerCase().includes("luxe"));
      if (match) return match;
    }

    return pool[0];
  }, [livePlans, selectedPackageId]);

  // Package switcher modal/drawer
  const [switchingPackage, setSwitchingPackage] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [priority, setPriority] = useState<PackagePriority | "">("");
  const [customPriority, setCustomPriority] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContact, setPreferredContact] = useState<"WhatsApp" | "Phone" | "Email">("WhatsApp");
  const [optionalMessage, setOptionalMessage] = useState("");

  // Validation & step states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const DRAFT_KEY = "sada_package_form_draft";

  // Restore draft from sessionStorage if visitor previously filled details
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.businessName) setBusinessName(d.businessName);
        if (d.category) setCategory(d.category);
        if (d.customCategory) setCustomCategory(d.customCategory);
        if (d.priority) setPriority(d.priority);
        if (d.customPriority) setCustomPriority(d.customPriority);
        if (d.fullName) setFullName(d.fullName);
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
        if (d.preferredContact) setPreferredContact(d.preferredContact);
        if (d.optionalMessage) setOptionalMessage(d.optionalMessage);
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  // Save form draft on change (unless already successfully submitted)
  useEffect(() => {
    if (typeof window === "undefined" || step === "success") return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          businessName,
          category,
          customCategory,
          priority,
          customPriority,
          fullName,
          phone,
          email,
          preferredContact,
          optionalMessage,
        })
      );
    } catch {
      // Ignore quota error
    }
  }, [
    businessName,
    category,
    customCategory,
    priority,
    customPriority,
    fullName,
    phone,
    email,
    preferredContact,
    optionalMessage,
    step,
  ]);

  // Synchronize package if initialPackageId prop changes
  useEffect(() => {
    if (initialPackageId && initialPackageId !== selectedPackageId) {
      setSelectedPackageId(initialPackageId);
    }
  }, [initialPackageId]);

  // Handle Package Change without losing form state
  const handleSelectPackage = (newId: PackageId) => {
    setSelectedPackageId(newId);
    setSwitchingPackage(false);
    navigate({
      to: "/contact",
      search: { package: newId },
      replace: true,
    } as any);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!businessName.trim()) {
      errs.businessName = isAr ? "اسم المشروع أو الشركة مطلوب." : "Business name is required.";
    } else if (businessName.trim().length > 120) {
      errs.businessName = isAr ? "لا يمكن لاسم المشروع أن يتجاوز 120 حرفاً." : "Business name cannot exceed 120 characters.";
    }

    if (!category) {
      errs.category = isAr ? "يرجى اختيار مجال عمل المشروع." : "Please select a business category.";
    } else if (category === "Other" && !customCategory.trim()) {
      errs.customCategory = isAr ? "يرجى تحديد طبيعة النشاط." : "Please specify your business type.";
    }

    if (!priority) {
      errs.priority = isAr ? "يرجى تحديد أولويتك الرئيسية." : "Please choose your primary priority.";
    } else if (priority === "Something else" && !customPriority.trim()) {
      errs.customPriority = isAr ? "يرجى توضيح ما يهمك أكثر." : "Please specify what matters most.";
    }

    if (!fullName.trim()) {
      errs.fullName = isAr ? "الاسم مطلوب." : "Your name is required.";
    } else if (fullName.trim().length < 2) {
      errs.fullName = isAr ? "يرجى إدخال حرفين على الأقل." : "Please enter at least 2 characters.";
    }

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (preferredContact === "Email") {
      if (!cleanEmail) {
        errs.email = isAr ? "البريد الإلكتروني مطلوب عند اختياره للتواصل." : "Email is required when Email is your preferred contact.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errs.email = isAr ? "يرجى إدخال عنوان بريد إلكتروني صالح." : "Please enter a valid email address.";
      }
    } else {
      if (!cleanPhone) {
        errs.phone = isAr
          ? `رقم الهاتف مطلوب عند اختيار ${preferredContact === "WhatsApp" ? "واتساب" : "الهاتف"}.`
          : `Phone number is required when ${preferredContact} is selected.`;
      } else if (cleanPhone.replace(/[^0-9+]/g, "").length < 6) {
        errs.phone = isAr ? "يرجى إدخال رقم هاتف صحيح للتواصل." : "Please enter a valid contact phone number.";
      }

      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errs.email = isAr ? "يرجى إدخال عنوان بريد إلكتروني صالح." : "Please enter a valid email address.";
      }
    }

    if (!cleanEmail && preferredContact !== "Email") {
      if (!cleanEmail) {
        errs.email = isAr ? "البريد الإلكتروني مطلوب لحفظ سجل استفسارك." : "Email address is required for your inquiry record.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(isAr ? "يرجى تعبئة كافة الحقول المطلوبة." : "Please fill in all required fields.");
      return;
    }
    setSubmissionError(null);
    setStep("confirm");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmissionError(null);

    try {
      // Re-resolve canonical package from source of truth to prevent client tampering
      const verifiedPlan = currentPlan;

      const finalCategory = category === "Other" && customCategory.trim()
        ? `Other: ${customCategory.trim()}`
        : category;

      const finalPriority = priority === "Something else" && customPriority.trim()
        ? customPriority.trim()
        : priority;

      const summaryText = `Selected ${verifiedPlan.name} (${verifiedPlan.price.toLocaleString()} ${verifiedPlan.currency} / ${verifiedPlan.unit}) for ${businessName.trim()} (${finalCategory}). Primary priority: ${finalPriority}.`;

      const formattedMessage = [
        `PACKAGE INQUIRY: ${verifiedPlan.name} (${verifiedPlan.price.toLocaleString()} ${verifiedPlan.currency} / ${verifiedPlan.unit})`,
        `BUSINESS: ${businessName.trim()} (${finalCategory})`,
        `PRIMARY PRIORITY: ${finalPriority}`,
        `CONTACT: ${fullName.trim()} · Preferred: ${preferredContact}`,
        phone.trim() ? `PHONE: ${phone.trim()}` : null,
        email.trim() ? `EMAIL: ${email.trim()}` : null,
        optionalMessage.trim() ? `\nCLIENT NOTE:\n${optionalMessage.trim()}` : null,
        `\nINCLUDED DELIVERABLES:\n${verifiedPlan.features.filter(f => f.included).map(f => `• ${f.label}`).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n");

      // Canonical structured discovery payload
      const discoveryPayload = {
        source: "Pricing / Package Selection",
        path_taken: "package",
        package_id: verifiedPlan.id,
        package_name: verifiedPlan.name,
        package_price: verifiedPlan.price,
        package_currency: verifiedPlan.currency,
        package_unit: verifiedPlan.unit,
        package_features: verifiedPlan.features.filter((f) => f.included).map((f) => f.label),
        business_name: businessName.trim(),
        business_type: finalCategory,
        primary_priority: finalPriority,
        main_problem: finalPriority,
        root_problem: finalPriority,
        priority_service: verifiedPlan.name,
        services_needed: verifiedPlan.features.filter((f) => f.included).map((f) => f.label),
        timeline: "Immediate / Retainer",
        budget_range: `${verifiedPlan.price.toLocaleString()} ${verifiedPlan.currency} / ${verifiedPlan.unit}`,
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        preferred_contact: preferredContact,
        optional_message: optionalMessage.trim() || null,
        request_summary: summaryText,
        likely_needs: verifiedPlan.features.filter((f) => f.included).slice(0, 4).map((f) => f.label),
        submitted_at: new Date().toISOString(),
      };

      // Payload strictly conforming to contact_submissions schema & RLS check constraints
      const insertPayload = {
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        business_name: businessName.trim().slice(0, 120),
        service: `${verifiedPlan.name} (${verifiedPlan.price.toLocaleString()} ${verifiedPlan.currency}/${verifiedPlan.unit})`.slice(0, 80),
        budget: `${verifiedPlan.price.toLocaleString()} ${verifiedPlan.currency}/${verifiedPlan.unit}`.slice(0, 40),
        message: formattedMessage.slice(0, 2000),
        status: "new",
        preferred_contact: preferredContact,
        // path_taken column is set to null to satisfy (path_taken IS NULL OR path_taken IN ('guided', 'quick', 'free_text'))
        path_taken: null,
        discovery_data: discoveryPayload as any,
        questionnaire_answers: discoveryPayload as any,
      };

      const { error } = await supabase.from("contact_submissions").insert(insertPayload);

      if (error) {
        console.error("Package inquiry submission error:", error);
        setSubmissionError(error.message || (isAr ? "فشل إرسال طلب الباقة. يرجى المحاولة مرة أخرى." : "Failed to submit package request. Please try again."));
        toast.error(isAr ? "فشل الإرسال. تم الاحتفاظ ببياناتك." : "Submission failed. Your details have been preserved.");
        setSubmitting(false);
        return;
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // Ignore
        }
      }

      toast.success(isAr ? `تم استلام طلب باقة ${currentPlan.name}!` : `Request received for ${verifiedPlan.name}!`);
      setStep("success");
    } catch (err: any) {
      console.error("Unexpected error during package submission:", err);
      setSubmissionError(err?.message || (isAr ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." : "An unexpected error occurred. Please try again."));
      toast.error(isAr ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlans && !currentPlan) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">
          {isAr ? "جاري تحميل تفاصيل الباقة المعتمدة..." : "Loading canonical package scope..."}
        </p>
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm font-semibold text-foreground">
          {isAr ? "تعذر العثور على الباقة المطلوبة" : "Selected package not found"}
        </p>
        <Link to="/pricing" className="text-xs text-primary underline">
          {isAr ? "العودة لكتالوج الباقات" : "Return to Package Catalog"}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* SUCCESS SCREEN */}
      {step === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-border bg-card p-7 sm:p-10 elevated-shadow text-center space-y-6"
        >
          <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center mx-auto text-white neon-glow">
            <CheckCircle2 className="size-8" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
              {isAr ? "أنت في قائمة اهتمامنا الفوري" : "You're on our radar"}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold">
              {isAr ? "تم استلام طلبك بنجاح." : "We received your request."}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {isAr ? (
                <>
                  شكراً لك — تم استلام طلبك لباقة{" "}
                  <strong className="text-foreground">{currentPlan.name}</strong> الخاصة بمشروع{" "}
                  <strong className="text-foreground">{businessName}</strong>.
                </>
              ) : (
                <>
                  Thanks — we've received your request for the{" "}
                  <strong className="text-foreground">{currentPlan.name}</strong> for{" "}
                  <strong className="text-foreground">{businessName}</strong>.
                </>
              )}
            </p>
          </div>

          {/* Structured confirmation recap card */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 text-start space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-border/50">
              <span className="font-mono text-muted-foreground uppercase">
                {isAr ? "الباقة المختارة" : "Selected Package"}
              </span>
              <span className="font-bold text-primary">
                {currentPlan.name} · <span className="ltr-force">{currentPlan.price.toLocaleString()}</span> {currentPlan.currency} / {currentPlan.unit}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? "المشروع" : "Business"}</span>
                <span className="font-semibold text-foreground">{businessName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? "المجال" : "Category"}</span>
                <span className="font-semibold text-foreground">{getLocalizedDiscoveryOption(category, language)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? "الأولوية الأولى" : "Primary Priority"}</span>
                <span className="font-semibold text-foreground">
                  {priority === "Something else" ? customPriority : (isAr && priority ? PACKAGE_PRIORITIES_AR[priority] : priority)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">{isAr ? "قناة التواصل" : "Contact Channel"}</span>
                <span className="font-semibold text-foreground">
                  {preferredContact === "WhatsApp" && isAr ? "واتساب" : preferredContact === "Phone" && isAr ? "هاتف" : preferredContact === "Email" && isAr ? "بريد إلكتروني" : preferredContact} ({preferredContact === "Email" ? email : phone})
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground text-start flex items-start gap-3">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong>{isAr ? "ما الذي سيحدث بعد ذلك:" : "What happens next:"}</strong>{" "}
              {isAr ? (
                <>سيقوم مسؤول الاستراتيجية لدينا بمراجعة ملف مشروعك والتواصل معك عبر <strong className="text-foreground">{preferredContact === "WhatsApp" ? "واتساب" : preferredContact === "Phone" ? "الهاتف" : "البريد الإلكتروني"}</strong> خلال 24 ساعة لبدء مرحلة الإطلاق.</>
              ) : (
                <>Our strategy lead will review your business profile and reach out via <strong className="text-foreground">{preferredContact}</strong> within 24 hours to coordinate kickoff.</>
              )}
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted transition-colors"
            >
              {isAr ? "العودة لجدول الباقات" : "Back to Pricing"}
            </Link>
            {phone && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  isAr
                    ? `مرحباً صدى! قمت للتو بإرسال طلب لباقة ${currentPlan.name} لمشروع ${businessName}.`
                    : `Hello SADA! I just submitted an inquiry for the ${currentPlan.name} for ${businessName}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-xs sm:text-sm font-semibold neon-glow hover:scale-[1.02] transition-transform inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="size-4" />
                {isAr ? "محادثة فورية عبر واتساب" : "Chat on WhatsApp Now"}
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* CONFIRMATION STEP */}
      {step === "confirm" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-6 sm:p-8 md:p-10 elevated-shadow space-y-6"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="size-3" /> {isAr ? "الخطوة ٢ من ٢ — تأكيد البيانات" : "Step 2 of 2 — Confirmation"}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              {isAr ? "أوشكت على الانتهاء." : "You're almost there."}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isAr
                ? "راجع تفاصيل الباقة المختارة وبيانات التواصل قبل اعتماد الإرسال النهائي."
                : "Review your package selection and contact details before we get in touch."}
            </p>
          </div>

          {submissionError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Recap Box */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase block">
                  {isAr ? "الباقة المختارة" : "You Selected"}
                </span>
                <h3 className="font-display text-xl font-bold text-foreground mt-0.5">
                  {currentPlan.name}
                </h3>
                <p className="text-xs text-muted-foreground">{currentPlan.tagline}</p>
              </div>
              <div className="text-end shrink-0">
                <div className="font-display text-2xl font-bold text-foreground">
                  <span className="ltr-force">{currentPlan.price.toLocaleString()}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {currentPlan.currency} / {currentPlan.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSwitchingPackage(true)}
                  className="text-xs text-primary hover:underline font-semibold mt-1 inline-block"
                >
                  {isAr ? "تغيير الباقة" : "Change package"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider block">
                  {isAr ? "اسم المشروع" : "Business Name"}
                </span>
                <span className="font-semibold text-foreground text-sm">{businessName}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider block">
                  {isAr ? "مجال العمل" : "Category"}
                </span>
                <span className="font-semibold text-foreground text-sm">
                  {category === "Other" && customCategory ? customCategory : getLocalizedDiscoveryOption(category, language)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider block">
                  {isAr ? "الأولوية الأولى" : "Primary Priority"}
                </span>
                <span className="font-semibold text-primary text-sm">
                  {priority === "Something else" && customPriority ? customPriority : (isAr && priority ? PACKAGE_PRIORITIES_AR[priority] : priority)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider block">
                  {isAr ? "طريقة التواصل" : "Preferred Contact"}
                </span>
                <span className="font-semibold text-foreground text-sm">
                  {preferredContact === "WhatsApp" && isAr ? "واتساب" : preferredContact === "Phone" && isAr ? "هاتف" : preferredContact === "Email" && isAr ? "بريد إلكتروني" : preferredContact} ({preferredContact === "Email" ? email : phone})
                </span>
              </div>
            </div>

            {optionalMessage.trim() && (
              <div className="pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider block mb-1">
                  {isAr ? "ملاحظات إضافية" : "Additional Note"}
                </span>
                <p className="text-foreground/90 italic bg-card p-3 rounded-xl border border-border/50">
                  "{optionalMessage.trim()}"
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-border bg-card text-xs sm:text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="size-4 rtl-flip" />
              {isAr ? "تعديل البيانات" : "Edit Details"}
            </button>

            <button
              type="button"
              onClick={() => setSwitchingPackage(true)}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs sm:text-sm font-semibold hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
            >
              <Layers className="size-4" />
              {isAr ? "تغيير الباقة" : "Change Package"}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full sm:flex-1 px-6 py-3 rounded-xl bg-gradient-primary text-white text-xs sm:text-sm font-semibold neon-glow hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isAr ? "جارٍ إرسال الطلب..." : "Submitting Request..."}
                </>
              ) : (
                <>
                  {isAr ? "تأكيد الطلب والبدء مع صدى" : "Confirm & Start With SADA"}{" "}
                  <ArrowRight className="size-4 rtl-flip" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* SHORT FORM SCREEN */}
      {step === "form" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-6 sm:p-8 md:p-10 elevated-shadow space-y-7 relative overflow-hidden"
        >
          {/* SECTION 1 — SELECTED PACKAGE BANNER */}
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 space-y-3 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
                  {isAr ? "الباقة المختارة" : "You Selected"}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {currentPlan.name}
                </h2>
                <p className="text-xs text-muted-foreground">{currentPlan.tagline}</p>
              </div>
              <div className="sm:text-end">
                <div className="flex items-baseline gap-1 sm:justify-end">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-foreground ltr-force">
                    {currentPlan.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentPlan.currency} / {currentPlan.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSwitchingPackage(true)}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  <Layers className="size-3" />
                  {isAr ? "تغيير الباقة" : "Change package"}
                </button>
              </div>
            </div>

            {/* Compact Included Deliverables Strip */}
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">
                {isAr ? "أبرز المخرجات المشمولة:" : "Key Deliverables Included:"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentPlan.features
                  .filter((f) => f.included)
                  .slice(0, 5)
                  .map((f) => (
                    <span
                      key={f.label}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-card/80 border border-border/80 text-foreground font-medium"
                    >
                      <Check className="size-3 text-primary shrink-0" />
                      {f.label}
                    </span>
                  ))}
                {currentPlan.features.filter((f) => f.included).length > 5 && (
                  <span className="text-[11px] text-muted-foreground self-center px-1">
                    +{currentPlan.features.filter((f) => f.included).length - 5} {isAr ? "ميزات أخرى" : "more"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleReview} className="space-y-7">
            {/* SECTION 2 — BUSINESS INFORMATION */}
            <div className="space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  {isAr ? "عن مشروعك / شركتك" : "About Your Business"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground" htmlFor="business-name-input">
                  {isAr ? "ما هو اسم مشروعك أو علامتك؟" : "What's your business called?"} <span className="text-destructive">*</span>
                </label>
                <input
                  id="business-name-input"
                  type="text"
                  placeholder={isAr ? "مثال: مقهى 707 أو استديو الأناقة" : "e.g. Café 707"}
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (errors.businessName) {
                      setErrors((prev) => {
                        const { businessName: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  className={`w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none transition-colors ${
                    errors.businessName ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                  }`}
                />
                {errors.businessName && (
                  <p className="text-[11px] text-destructive font-medium">{errors.businessName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground" htmlFor="business-category-select">
                  {isAr ? "ما هو مجال عملك الأقرب؟" : "What best describes your business?"} <span className="text-destructive">*</span>
                </label>
                <SADASelect
                  id="business-category-select"
                  value={category}
                  onChange={(val) => {
                    setCategory(val);
                    if (errors.category) {
                      setErrors((prev) => {
                        const { category: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  error={!!errors.category}
                  placeholder={isAr ? "اختر مجال عملك..." : "Select your business category..."}
                  options={BUSINESS_TYPES.map((t) => ({
                    value: t,
                    label: getLocalizedDiscoveryOption(t, language),
                  }))}
                />
                {errors.category && (
                  <p className="text-[11px] text-destructive font-medium">{errors.category}</p>
                )}

                {category === "Other" && (
                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder={isAr ? "يرجى تحديد طبيعة النشاط..." : "Please specify your business type..."}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm outline-none focus:border-primary"
                    />
                    {errors.customCategory && (
                      <p className="text-[11px] text-destructive font-medium mt-1">{errors.customCategory}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3 — PRIMARY PRIORITY */}
            <div className="space-y-3">
              <div className="border-b border-border/60 pb-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
                  {isAr ? "ما هي أولويتك الكبرى في هذه المرحلة؟" : "What's your biggest priority right now?"} <span className="text-destructive">*</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr ? "اختر النتيجة الأهم التي تسعى لتحقيقها أولاً." : "Pick the single outcome that matters most to you."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Primary Priority">
                {PACKAGE_PRIORITIES.map((p) => {
                  const isSelected = priority === p;
                  const label = isAr ? PACKAGE_PRIORITIES_AR[p] || p : p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setPriority(p);
                        if (errors.priority) {
                          setErrors((prev) => {
                            const { priority: _, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className={`p-3 rounded-xl text-start text-xs font-semibold border transition-all duration-150 flex items-center justify-between gap-2 ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <span>{label}</span>
                      {isSelected && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {errors.priority && (
                <p className="text-[11px] text-destructive font-medium">{errors.priority}</p>
              )}

              {priority === "Something else" && (
                <div className="pt-1.5">
                  <input
                    type="text"
                    placeholder={isAr ? "أخبرنا بما يهمك تحقيقه في هذه المرحلة..." : "Tell us what matters most right now..."}
                    value={customPriority}
                    onChange={(e) => setCustomPriority(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm outline-none focus:border-primary"
                  />
                  {errors.customPriority && (
                    <p className="text-[11px] text-destructive font-medium mt-1">{errors.customPriority}</p>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4 — CONTACT INFORMATION */}
            <div className="space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
                  {isAr ? "كيف نتمكن من التواصل معك؟" : "How can we reach you?"}
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground" htmlFor="contact-name-input">
                  {isAr ? "الاسم بالكامل" : "Your Full Name"} <span className="text-destructive">*</span>
                </label>
                <input
                  id="contact-name-input"
                  type="text"
                  placeholder={isAr ? "مثال: أميرة بن سالم" : "e.g. Amira Ben Salem"}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors((prev) => {
                        const { fullName: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  className={`w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none transition-colors ${
                    errors.fullName ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                  }`}
                />
                {errors.fullName && (
                  <p className="text-[11px] text-destructive font-medium">{errors.fullName}</p>
                )}
              </div>

              {/* Preferred contact channel pills */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  {isAr ? "طريقة التواصل المفضلة" : "Preferred Contact Method"}
                </label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Preferred Contact Method">
                  {(["WhatsApp", "Phone", "Email"] as const).map((method) => {
                    const isSelected = preferredContact === method;
                    const Icon = method === "WhatsApp" ? MessageCircle : method === "Phone" ? Phone : Mail;
                    const label = method === "WhatsApp" && isAr ? "واتساب" : method === "Phone" && isAr ? "هاتف" : method === "Email" && isAr ? "بريد إلكتروني" : method;
                    return (
                      <button
                        key={method}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setPreferredContact(method);
                          if (errors.phone || errors.email) {
                            setErrors((prev) => {
                              const { phone: _, email: __, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground" htmlFor="contact-phone-input">
                    {isAr ? "رقم الهاتف / الواتساب" : "Phone Number"}{" "}
                    {preferredContact !== "Email" && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    id="contact-phone-input"
                    type="tel"
                    dir="ltr"
                    placeholder="+216 98 123 456"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) {
                        setErrors((prev) => {
                          const { phone: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={`w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none transition-colors text-start ${
                      errors.phone ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-destructive font-medium">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground" htmlFor="contact-email-input">
                    {isAr ? "البريد الإلكتروني" : "Email Address"} <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="contact-email-input"
                    type="email"
                    dir="ltr"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) {
                        setErrors((prev) => {
                          const { email: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={`w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none transition-colors text-start ${
                      errors.email ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-[11px] text-destructive font-medium">{errors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5 — OPTIONAL MESSAGE */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground" htmlFor="optional-notes-input">
                {isAr ? "هل تود إضافة أي تفاصيل أخرى؟" : "Anything else you'd like us to know?"}{" "}
                <span className="text-muted-foreground font-normal">{isAr ? "(اختياري)" : "(Optional)"}</span>
              </label>
              <textarea
                id="optional-notes-input"
                rows={3}
                placeholder={
                  isAr
                    ? "موعد الإطلاق المستهدف، القنوات النشطة حالياً، أو أي أفكار ترغب بمشاركتها..."
                    : "Specific launch timeline, current active channels, or upcoming campaign ideas..."
                }
                value={optionalMessage}
                onChange={(e) => setOptionalMessage(e.target.value)}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            {/* CTA SUBMISSION */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-primary text-white font-semibold text-sm sm:text-base neon-glow hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
              >
                {isAr ? "مراجعة وتأكيد الاختيار" : "Review & Confirm Selection"}{" "}
                <ArrowRight className="size-4 rtl-flip" />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* PACKAGE SWITCHER MODAL */}
      <AnimatePresence>
        {switchingPackage && (
          <div className="fixed inset-0 z-50 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 elevated-shadow space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div>
                  <h3 className="font-display text-xl font-bold">
                    {isAr ? "اختر باقة صدى المناسبة" : "Choose a SADA Package"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "سيتم الاحتفاظ بكافة البيانات التي أدخلتها." : "Your entered form details will be preserved."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSwitchingPackage(false)}
                  className="size-8 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {livePlans.map((p) => {
                  const isCurrent = p.id === selectedPackageId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPackage(p.id)}
                      className={`w-full p-4 rounded-2xl text-start border transition-all flex items-center justify-between gap-4 ${
                        isCurrent
                          ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-foreground">{p.name}</span>
                          {p.popular && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-white">
                              {isAr ? "الأكثر طلباً" : "Popular"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.tagline}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="font-bold text-base text-foreground">
                          <span className="ltr-force">{p.price.toLocaleString()}</span> {p.currency}
                        </div>
                        <span className="text-[11px] text-muted-foreground">/ {p.unit}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  to="/pricing"
                  className="text-xs text-muted-foreground hover:text-primary font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="size-3 rtl-flip" />
                  {isAr ? "عرض جدول مقارنة الباقات كاملاً" : "View full pricing comparison table"}
                </Link>
                <button
                  type="button"
                  onClick={() => setSwitchingPackage(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-muted text-xs font-semibold text-foreground hover:bg-muted/80"
                >
                  {isAr ? "الإبقاء على الحالية" : "Keep Current"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
