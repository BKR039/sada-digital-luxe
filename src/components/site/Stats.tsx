import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import { fetchSiteKpis, SiteKpi, DEFAULT_COMPANY_STATS } from "@/lib/site-content-service";
import { DynamicIcon } from "@/components/common/DynamicIcon";

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v)}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, mv]);

  return (
    <span ref={ref} className="inline-flex items-baseline" dir="ltr">
      <motion.span>{rounded}</motion.span>
      <span className="text-primary dark:text-cyan-400">{suffix}</span>
    </span>
  );
}

export function Stats() {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const [stats, setStats] = useState<SiteKpi[]>(DEFAULT_COMPANY_STATS);

  useEffect(() => {
    let isMounted = true;
    fetchSiteKpis("company_stats").then((data) => {
      if (isMounted && data && data.length > 0) {
        setStats(data.filter((k) => k.is_active));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-border bg-card/90 dark:bg-card/40 backdrop-blur-md soft-shadow p-6 sm:p-8 md:p-10 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4 items-center justify-center">
          {stats.map((s, i) => (
            <motion.div
              key={s.id || s.metric_key || i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className="flex flex-col items-center justify-center text-center p-2 lg:px-4 lg:border-e lg:border-border/60 dark:lg:border-border/30 last:border-e-0"
            >
              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                {s.icon && (
                  <span className="p-1.5 sm:p-2 rounded-xl bg-primary/10 text-primary dark:text-cyan-400 inline-flex items-center justify-center shrink-0">
                    <DynamicIcon name={s.icon} className="size-4 sm:size-5" />
                  </span>
                )}
                <div className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-display font-extrabold text-foreground dark:text-gradient tabular-nums tracking-tight">
                  {s.prefix && <span>{s.prefix}</span>}
                  <Counter to={s.value} suffix={s.suffix || ""} />
                </div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-medium whitespace-nowrap text-center">
                {isAr ? s.label_ar : s.label_en}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

