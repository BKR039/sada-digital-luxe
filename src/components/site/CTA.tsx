import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

interface CTAProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

export function CTA({
  title = "Ready to grow your brand?",
  subtitle = "Let's build something the world can't ignore. Tell us about your project — we reply within 24h.",
  primaryLabel = "Start a project",
  primaryTo = "/contact",
  secondaryLabel = "Explore services",
  secondaryTo = "/services",
}: CTAProps) {
  return (
    <section className="relative py-16 md:py-20 px-4">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="relative rounded-[2rem] p-10 md:p-16 text-center overflow-hidden bg-gradient-primary elevated-shadow"
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay grid-bg" />
          <div className="relative text-white">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              {title}
            </h2>
            <p className="mt-4 text-white/85 max-w-xl mx-auto">
              {subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link to={primaryTo} className="inline-flex items-center gap-2 bg-white text-primary px-7 py-3.5 rounded-2xl font-semibold hover:scale-[1.03] transition-transform">
                {primaryLabel} <ArrowRight className="size-4" />
              </Link>
              <Link to={secondaryTo} className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white px-7 py-3.5 rounded-2xl font-semibold hover:bg-white/15 transition-colors">
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
