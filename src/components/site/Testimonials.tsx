import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { useTranslation } from "@/i18n";

interface T {
  id: string;
  client_name: string;
  company: string | null;
  role: string | null;
  review: string;
  short_quote: string | null;
  photo_url: string | null;
  featured: boolean;
  language?: string | null;
}

export function Testimonials() {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("testimonials")
      .select("id,client_name,company,role,review,short_quote,photo_url,featured,language")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .then(
        ({ data, error }) => {
          if (!active) return;
          setLoading(false);
          if (!error && data) {
            const all = (data as T[]) || [];
            if (all.length > 0) {
              const langMatches = all.filter((r) => r.language === language);
              setItems(langMatches.length > 0 ? langMatches : all);
            } else {
              setItems([]);
            }
          }
        },
        () => {
          if (active) setLoading(false);
        }
      );

    return () => {
      active = false;
    };
  }, [language]);

  if (loading) {
    return (
      <section className="relative py-16 md:py-20 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 uppercase">
              {isAr ? "آراء العملاء" : "CLIENT PROOF"}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              {isAr ? (
                <>شركاء النجاح <span className="text-gradient">والعلامات الصاعدة</span></>
              ) : (
                <>Trusted by <span className="text-gradient">growing brands</span></>
              )}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-3xl border border-border/40 bg-card/40 p-7 animate-pulse"
              >
                <div className="h-6 w-6 bg-muted/40 rounded mb-4" />
                <div className="h-4 bg-muted/30 rounded w-full mb-2" />
                <div className="h-4 bg-muted/30 rounded w-4/5 mb-6" />
                <div className="h-4 bg-muted/40 rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-3.5 sm:px-4">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12 max-w-2xl mx-auto"
        >
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
            {isAr ? "آراء العملاء" : "CLIENT PROOF"}
          </p>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            {isAr ? (
              <>شركاء النجاح <span className="text-gradient">والعلامات الصاعدة</span></>
            ) : (
              <>Trusted by <span className="text-gradient">growing brands</span></>
            )}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-3.5 sm:gap-5">
          {items.slice(0, 6).map((t, i) => {
            const attribution = [t.role, t.company].filter(Boolean).join(", ");
            return (
              <motion.figure
                key={t.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                dir={t.language === "ar" ? "rtl" : "ltr"}
                className="rounded-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-6 md:p-7 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <Quote className="size-5 sm:size-6 text-primary/70 mb-2.5 sm:mb-3" />
                  <blockquote
                    dir={t.language === "ar" ? "rtl" : "ltr"}
                    className="text-xs sm:text-sm leading-relaxed text-foreground/90"
                  >
                    "{t.short_quote || t.review}"
                  </blockquote>
                </div>

                <figcaption className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-border flex items-center gap-2.5 sm:gap-3">
                  <div className="size-9 sm:size-10 rounded-full overflow-hidden bg-gradient-primary grid place-items-center font-bold text-xs sm:text-sm text-white shrink-0">
                    {t.photo_url ? (
                      <SmartMedia
                        src={t.photo_url}
                        className="w-full h-full object-cover"
                        autoplay={false}
                      />
                    ) : (
                      t.client_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm truncate">{t.client_name}</div>
                    {attribution && (
                      <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{attribution}</div>
                    )}
                  </div>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
