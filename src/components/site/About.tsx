import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function About() {
  const points = [
    "Build a strong identity that doesn't fade",
    "Create content that attracts and converts",
    "Engineer a digital presence that earns trust",
  ];
  return (
    <section className="relative py-16 md:py-20 px-4 bg-gradient-soft">
      <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5 }}>
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">WHO WE ARE</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            In a world full of <span className="text-gradient">noise</span>, we make voices that get heard.
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            SADA is a digital marketing agency specialized in identity and content. We help companies and brands stand out — not just be seen, but believed.
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{p}</span>
              </li>
            ))}
          </ul>
          <Link to="/about" className="mt-10 inline-flex items-center gap-2 bg-card border border-border px-6 py-3 rounded-xl font-semibold hover:bg-muted transition-colors soft-shadow">
            Read our story →
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5 }}>
          <div className="rounded-3xl border border-border bg-card p-7 elevated-shadow">
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "Content", v: "that converts" },
                { k: "Branding", v: "that lasts" },
                { k: "Strategy", v: "that scales" },
                { k: "Growth", v: "that compounds" },
              ].map((item) => (
                <div key={item.k} className="rounded-2xl border border-border bg-muted/40 p-5 hover:bg-muted transition-colors">
                  <div className="text-xl font-display font-bold text-gradient">{item.k}</div>
                  <div className="text-sm text-muted-foreground mt-1">{item.v}</div>
                </div>
              ))}
            </div>
            <blockquote className="mt-6 italic text-sm text-muted-foreground border-l-2 border-primary pl-4">
              "We don't make content that's only watched — we make content that influences and convinces."
            </blockquote>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
