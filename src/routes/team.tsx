import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { Instagram, Linkedin, Twitter, Globe } from "lucide-react";

interface Member { id: string; name: string; position: string; bio: string | null; photo_url: string | null; socials: any; featured?: boolean }

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [
    { title: "Team — SADA" },
    { name: "description", content: "Meet the creative team behind SADA." },
    { property: "og:title", content: "Team — SADA" },
    { property: "og:description", content: "The minds behind SADA's creative work." },
  ] }),
  component: Team,
});

function Team() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("team_members").select("*").eq("published", true).order("sort_order")
      .then(({ data }) => { setItems((data as any) || []); setLoading(false); });
  }, []);
  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">TEAM</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95]">The minds behind <span className="text-gradient">the work</span>.</h1>
        {loading ? (
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-3xl glass animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">Add team members from the admin dashboard.</div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((m, i) => (
              <motion.div key={m.id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: Math.min(i, 8) * 0.06, duration: 0.5 }}
                className="group glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all">
                <div className="aspect-square overflow-hidden">
                  {m.photo_url ? (
                    <SmartMedia src={m.photo_url} className="w-full h-full transition-transform duration-700 group-hover:scale-110" autoplay={false} />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-6xl font-display font-bold text-gradient bg-gradient-to-br from-primary/30 to-accent/30">{m.name.charAt(0)}</div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-bold">{m.name}</h3>
                  <p className="text-sm text-accent">{m.position}</p>
                  {m.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{m.bio}</p>}
                  <div className="mt-4 flex gap-2">
                    {m.socials?.instagram && <a href={m.socials.instagram} target="_blank" rel="noreferrer" className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Instagram className="size-3.5" /></a>}
                    {m.socials?.linkedin && <a href={m.socials.linkedin} target="_blank" rel="noreferrer" className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Linkedin className="size-3.5" /></a>}
                    {m.socials?.twitter && <a href={m.socials.twitter} target="_blank" rel="noreferrer" className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Twitter className="size-3.5" /></a>}
                    {m.socials?.website && <a href={m.socials.website} target="_blank" rel="noreferrer" className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Globe className="size-3.5" /></a>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
