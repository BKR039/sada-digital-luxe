import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface T { id: string; client_name: string; company: string | null; review: string; rating: number; photo_url: string | null }

const FALLBACK: T[] = [
  { id: "1", client_name: "Layla M.", company: "Founder, Northstar Café", review: "SADA rebuilt our brand in 6 weeks — followers up 4x and our launch sold out. They actually understand strategy.", rating: 5, photo_url: null },
  { id: "2", client_name: "Hassan A.", company: "CEO, Velocity Auto", review: "The reels they made for us are still our top performers a year later. Worth every dirham.", rating: 5, photo_url: null },
  { id: "3", client_name: "Sara K.", company: "Marketing Lead, Bloom", review: "From identity to ads, every deliverable felt premium. They raised our standards.", rating: 5, photo_url: null },
];

export function Testimonials() {
  const [items, setItems] = useState<T[]>(FALLBACK);
  useEffect(() => {
    supabase.from("testimonials").select("*").eq("published", true).order("sort_order").then(({ data }) => {
      if (data && data.length) setItems(data as T[]);
    });
  }, []);
  return (
    <section className="relative py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5 }} className="text-center mb-12 max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">CLIENT LOVE</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Trusted by <span className="text-gradient">growing brands</span></h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.slice(0, 6).map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="rounded-3xl border border-border bg-card p-7 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
            >
              <Quote className="size-6 text-primary/70 mb-3" />
              <p className="text-sm leading-relaxed text-foreground/90">"{t.review}"</p>
              <div className="flex gap-0.5 mt-4">
                {Array.from({ length: t.rating }).map((_, k) => (
                  <Star key={k} className="size-3.5 fill-primary text-primary" />
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-primary grid place-items-center font-bold text-sm text-white">
                  {t.client_name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.client_name}</div>
                  <div className="text-xs text-muted-foreground">{t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
