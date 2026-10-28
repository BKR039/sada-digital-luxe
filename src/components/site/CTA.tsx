import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";

interface CTAProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

export function CTA({
  title,
  subtitle,
  primaryLabel,
  primaryTo = "/contact",
  secondaryLabel,
  secondaryTo = "/services",
}: CTAProps) {
  const { t } = useTranslation();

  const finalTitle = title || t("cta.title");
  const finalSubtitle = subtitle || t("cta.subtitle");
  const finalPrimaryLabel = primaryLabel || t("common.startProject");
  const finalSecondaryLabel = secondaryLabel || t("common.exploreServices");

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-3.5 sm:px-4">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 md:p-16 text-center overflow-hidden bg-gradient-primary elevated-shadow"
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay grid-bg" />
          <div className="relative text-white">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              {finalTitle}
            </h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-base text-white/90 max-w-xl mx-auto leading-relaxed">
              {finalSubtitle}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center items-stretch sm:items-center">
              <Link to={primaryTo} className="inline-flex items-center justify-center gap-2 bg-white text-primary px-6 py-3 rounded-xl sm:rounded-2xl font-semibold hover:scale-[1.02] active:scale-95 transition-transform text-sm sm:text-base">
                {finalPrimaryLabel} <ArrowRight className="size-4 rtl-flip" />
              </Link>
              <Link to={secondaryTo} className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/30 text-white px-6 py-3 rounded-xl sm:rounded-2xl font-semibold hover:bg-white/15 transition-colors text-sm sm:text-base">
                {finalSecondaryLabel}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
