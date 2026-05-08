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
    <section className="relative py-28 px-4">
      <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-16 items-center">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
          <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">WHO WE ARE</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            In a world full of <span className="text-gradient">noise</span>, we make voices that get heard.
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            SADA is a digital marketing agency specialized in building identity and creating content that makes a difference. We help companies and brands stand out — not just be seen, but believed.
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-accent shrink-0 mt-0.5" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link to="/about" className="mt-10 inline-flex items-center gap-2 glass-strong px-6 py-3 rounded-xl font-semibold hover:cyan-glow transition-all">
            Read our story →
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className="relative">
          <div className="glass-strong rounded-3xl p-8 cyan-glow">
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Content", v: "that converts" },
                { k: "Branding", v: "that lasts" },
                { k: "Strategy", v: "that scales" },
                { k: "Growth", v: "that compounds" },
              ].map((item) => (
                <div key={item.k} className="glass rounded-2xl p-5 hover:bg-primary/10 transition-colors">
                  <div className="text-2xl font-display font-bold text-gradient">{item.k}</div>
                  <div className="text-sm text-muted-foreground mt-1">{item.v}</div>
                </div>
              ))}
            </div>
            <blockquote className="mt-6 italic text-sm text-muted-foreground border-l-2 border-accent pl-4">
              "We don't make content that's only watched — we make content that influences and convinces."
            </blockquote>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
