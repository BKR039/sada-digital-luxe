// ============================================================
// SADA OS — SMART MATCHER: SUCCESS CONFIRMATION VIEW
// "You're all set" executive confirmation, match snapshot, 24h SLA, & WhatsApp acceleration
// ============================================================

import { motion } from "framer-motion";
import {
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Building,
  Clock,
  ExternalLink,
  RotateCcw,
  Home,
} from "lucide-react";
import { SADAButton, SADABadge, SADACard } from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/i18n";
import type { ContactDetails, PackageRecommendation } from "@/types/smart-match";

interface SmartMatchSuccessViewProps {
  lead: ContactDetails;
  packageRec: PackageRecommendation | null;
  source: string;
  onReset: () => void;
}

export function SmartMatchSuccessView({
  lead,
  packageRec,
  source,
  onReset,
}: SmartMatchSuccessViewProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const whatsappMessage = encodeURIComponent(
    `Hello SADA Team! My name is ${lead.fullName} (${lead.businessName}). I just completed the Smart Package Matcher on your website for "${packageRec?.packageName || "a custom strategic package"}". Looking forward to connecting!`
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto space-y-6 text-center"
    >
      <SADACard className="p-8 sm:p-12 border-border space-y-8 bg-card/90 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-24 size-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* 22. EMOTIONAL PAYOFF ICON */}
        <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center mx-auto text-white neon-glow shadow-xl relative">
          <CheckCircle2 className="size-9 stroke-[2.5]" />
        </div>

        {/* 22. HEADLINE & ACKNOWLEDGEMENT */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-emerald-500 block">
            {isAr ? "تم تسجيل الاستشارة بنجاح" : "CONFIRMATION RECEIVED"}
          </span>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-foreground tracking-tight">
            {isAr ? "أنت جاهز تماماً." : "You're all set."}
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {isAr ? (
              <>
                تم استلام طلبك وموجز نشاطك التجاري{" "}
                <span className="font-bold text-foreground">({lead.businessName})</span> بنجاح من قبل فريق صدى.
              </>
            ) : (
              <>
                Your brief has been received by SADA. A senior strategist is reviewing your requirements for{" "}
                <span className="font-bold text-foreground">{lead.businessName}</span>.
              </>
            )}
          </p>
        </div>

        {/* 22. RECOMMENDED PACKAGE & METRICS SNAPSHOT */}
        {packageRec && (
          <div className="p-5 rounded-2xl border border-primary/25 bg-primary/[0.04] text-start space-y-3">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono block">
                    {isAr ? "الباقة الموصى بها" : "RECOMMENDED PACKAGE"}
                  </span>
                  <div className="font-extrabold text-foreground text-base sm:text-lg font-display">
                    {isAr ? (packageRec.packageNameAr || packageRec.packageName) : packageRec.packageName}
                  </div>
                </div>
              </div>

              <div className="text-end">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full block">
                  <SADANumber variant="percent" value={packageRec.score} /> {isAr ? "توافق" : "Match"}
                </span>
                {packageRec.packagePrice > 0 && (
                  <div className="mt-0.5">
                    <SADANumber
                      variant="metric"
                      value={packageRec.packagePrice}
                      currency={packageRec.currency || "TND"}
                      className="text-xs font-bold text-foreground"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground font-mono">
                <Clock className="size-3.5 text-primary shrink-0" />
                <span>{isAr ? "الرد المتوقع: خلال 24 ساعة" : "Response: Within 24 hours"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground font-mono justify-end">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {isAr ? "مستشار مخصص للملف" : "Assigned Strategist"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 22. WHATSAPP FAST-TRACK ACCELERATOR */}
        <div className="p-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] space-y-3 text-start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">
              <MessageCircle className="size-4" />
              {isAr ? "هل ترغب في تسريع الخطوات؟" : "Want to move faster?"}
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              {isAr ? "أولوية فورية" : "Priority Channel"}
            </span>
          </div>

          <p className="text-xs text-foreground/80 leading-relaxed">
            {isAr
              ? "يمكنك بدء محادثة مباشرة الآن مع مستشار صدى على واتساب لمناقشة التوصية وتحديد موعد جلسة العمل الأولى."
              : "Skip the queue. Connect directly with a SADA lead strategist on WhatsApp to fast-track your brief review and schedule onboarding."}
          </p>

          <a
            href={`https://wa.me/21698123456?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md min-h-[44px] whitespace-nowrap shrink-0 [&_svg]:shrink-0"
          >
            <MessageCircle className="size-4 shrink-0" />
            <span>{isAr ? "محادثة فورية مع المستشار على واتساب" : "Chat on WhatsApp Now"}</span>
            <ExternalLink className="size-3.5 shrink-0 rtl:rotate-180 opacity-80" />
          </a>
        </div>

        {/* 22. FOOTER NAVIGATION ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-5 border-t border-border">
          <SADAButton
            variant="outline"
            onClick={onReset}
            className="w-full sm:w-auto text-xs sm:text-sm gap-2 min-h-[44px] px-6 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            {isAr ? "بدء استكشاف آخر" : "Start Another Match"}
          </SADAButton>

          <Link to="/" className="w-full sm:w-auto shrink-0 inline-block">
            <SADAButton
              variant="secondary"
              className="w-full sm:w-auto text-xs sm:text-sm gap-2 min-h-[44px] px-6 whitespace-nowrap shrink-0"
            >
              <Home className="size-3.5 shrink-0" />
              {isAr ? "العودة للرئيسية" : "Return to Home"}
            </SADAButton>
          </Link>
        </div>
      </SADACard>
    </motion.div>
  );
}
