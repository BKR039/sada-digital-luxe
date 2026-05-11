import { motion } from "framer-motion";
import { Camera, ThumbsUp, MonitorSmartphone, Megaphone, Lightbulb, Video, type LucideIcon } from "lucide-react";

const SERVICES: { title: string; desc: string; Icon: LucideIcon }[] = [
  { title: "Content Creation", desc: "Photography, video & short-form built to stop the scroll.", Icon: Camera },
  { title: "Branding", desc: "Identity systems that earn trust and stand out in your market.", Icon: Lightbulb },
  { title: "Social Media", desc: "Strategy, posting and growth — a complete social operating system.", Icon: ThumbsUp },
  { title: "Web Design", desc: "Modern, premium sites engineered to convert visitors into clients.", Icon: MonitorSmartphone },
  { title: "Paid Ads", desc: "Meta & TikTok performance campaigns — tracked, optimized, scaled.", Icon: Megaphone },
  { title: "Video Production", desc: "Cinematic shoots, premium edits and reels that perform.", Icon: Video },
];

export function Services() {
  return (
    <section className="relative py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">OUR SERVICES</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            Everything your brand needs <span className="text-gradient">to grow.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            An end-to-end studio for brands that want to be seen, heard and remembered.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.05, duration: 0.45 }}
              className="group relative rounded-3xl border border-border bg-card p-7 soft-shadow hover:-translate-y-1 hover:elevated-shadow transition-all"
            >
              <div className="size-12 rounded-2xl bg-gradient-primary grid place-items-center neon-glow">
                <s.Icon className="size-6 text-white" />
              </div>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              <div className="mt-5 inline-flex items-center text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more →
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
