import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Linkedin, Twitter, Globe } from "lucide-react";

interface Member { id: string; name: string; position: string; bio: string | null; photo_url: string | null; socials: any }

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — SADA" }, { name: "description", content: "Meet the team behind SADA." }] }),
  component: Team,
});

function Team() {
  const [items, setItems] = useState<Member[]>([]);
  useEffect(() => {
    supabase.from("team_members").select("*").eq("published", true).order("sort_order").then(({ data }) => setItems((data as any) || []));
  }, []);
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">TEAM</p>
        <h1 className="font-display text-5xl md:text-7xl font-bold">The minds behind <span className="text-gradient">the work</span>.</h1>
        {items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">Add team members from the admin dashboard.</div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((m, i) => (
              <motion.div key={m.id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="group glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all">
                <div className="aspect-square bg-gradient-to-br from-primary/30 to-accent/30">
                  {m.photo_url
                    ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    : <div className="w-full h-full grid place-items-center text-6xl font-display font-bold text-gradient">{m.name.charAt(0)}</div>}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-bold">{m.name}</h3>
                  <p className="text-sm text-accent">{m.position}</p>
                  {m.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{m.bio}</p>}
                  <div className="mt-4 flex gap-2">
                    {m.socials?.instagram && <a href={m.socials.instagram} className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Instagram className="size-3.5" /></a>}
                    {m.socials?.linkedin && <a href={m.socials.linkedin} className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Linkedin className="size-3.5" /></a>}
                    {m.socials?.twitter && <a href={m.socials.twitter} className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Twitter className="size-3.5" /></a>}
                    {m.socials?.website && <a href={m.socials.website} className="size-8 grid place-items-center rounded-lg bg-white/5 hover:bg-primary/20"><Globe className="size-3.5" /></a>}
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
