import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="relative py-28 px-4">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="relative glass-strong rounded-[2.5rem] p-12 md:p-16 text-center overflow-hidden cyan-glow">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-[500px] rounded-full bg-gradient-primary opacity-20 blur-[100px]" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
              Ready to <span className="text-gradient">make noise?</span>
            </h2>
            <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
              Let's build a brand the world can't ignore. Tell us about your project — we reply within 24h.
            </p>
            <Link to="/contact" className="mt-10 inline-flex items-center gap-2 bg-gradient-primary px-8 py-4 rounded-2xl font-semibold neon-glow hover:scale-105 transition-transform">
              Start a project <ArrowRight className="size-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
