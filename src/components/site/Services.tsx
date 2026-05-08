import { motion } from "framer-motion";
import { Camera, ThumbsUp, MonitorSmartphone, Megaphone, Lightbulb, Rocket, type LucideIcon } from "lucide-react";

const SERVICES: { title: string; desc: string; tags: string[]; Icon: LucideIcon }[] = [
  { title: "Content Creation", desc: "Photography, video editing, premium reels and short-form built to stop the scroll.", tags: ["Photo", "Video", "Reels"], Icon: Camera },
  { title: "Social Media Management", desc: "Strategy, publishing, growth — a complete operating system for your social presence.", tags: ["Strategy", "Posting", "Growth"], Icon: ThumbsUp },
  { title: "Web Design", desc: "Modern, premium websites engineered for conversion and brand authority.", tags: ["Design", "Build", "Launch"], Icon: MonitorSmartphone },
  { title: "Paid Ads", desc: "Meta & TikTok performance campaigns. Tracked, optimized, scaled.", tags: ["Meta", "TikTok", "Funnels"], Icon: Megaphone },
  { title: "Brand Development", desc: "Identity systems and positioning that earn trust and stand out in a crowded market.", tags: ["Identity", "Voice", "Strategy"], Icon: Lightbulb },
  { title: "Brand Growth", desc: "Long-term partnerships that turn attention into revenue and revenue into momentum.", tags: ["Retainer", "Scale", "Results"], Icon: Rocket },
];

export function Services() {
  return (
    <section className="relative py-28 px-4">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">OUR SERVICES</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold">What we <span className="text-gradient">build</span></h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">An end-to-end studio for brands that want to be seen, heard and felt.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <motion.div key={s.title}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group relative glass glow-border rounded-3xl p-7 hover:-translate-y-1.5 transition-all duration-500 hover:cyan-glow overflow-hidden">
              <div className="absolute -top-20 -right-20 size-48 rounded-full bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="size-14 rounded-2xl bg-gradient-primary grid place-items-center mb-5 neon-glow">
                  <s.Icon className="size-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
