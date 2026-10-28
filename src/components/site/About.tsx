import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/i18n";

export function About() {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const points = isAr
    ? [
        "بناء هوية راسخة لا تتلاشى مع الوقت",
        "صناعة محتوى يجذب العملاء ويحقق التحويل",
        "هندسة حضور رقمي يكتسب الثقة والمصداقية",
      ]
    : [
        "Build a strong identity that doesn't fade",
        "Create content that attracts and converts",
        "Engineer a digital presence that earns trust",
      ];

  const cards = isAr
    ? [
        { k: "المحتوى", v: "يحقق التحويل" },
        { k: "الهوية", v: "تدوم طويلاً" },
        { k: "الاستراتيجية", v: "قابلة للتوسع" },
        { k: "النمو", v: "يتضاعف تراكمياً" },
      ]
    : [
        { k: "Content", v: "that converts" },
        { k: "Branding", v: "that lasts" },
        { k: "Strategy", v: "that scales" },
        { k: "Growth", v: "that compounds" },
      ];

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-3.5 sm:px-4 bg-gradient-soft">
      <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2.5 sm:mb-3 uppercase">
            {isAr ? "من نحن" : "WHO WE ARE"}
          </p>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight">
            {isAr ? (
              <>في عالم مليء <span className="text-gradient">بالضجيج</span>، نصنع أصواتاً تفرض حضورها وتُسمع.</>
            ) : (
              <>In a world full of <span className="text-gradient">noise</span>, we make voices that get heard.</>
            )}
          </h2>
          <p className="mt-3.5 sm:mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
            {isAr
              ? "صدى هي وكالة رقمية وإبداعية متخصصة في بناء الهوية وصناعة المحتوى الاستراتيجي. نساعد الشركات على البروز — ليس فقط لتتم رؤيتها، بل لتكتسب الثقة وتُصدَّق."
              : "SADA is a digital marketing agency specialized in identity and content. We help companies and brands stand out — not just be seen, but believed."}
          </p>
          <ul className="mt-6 sm:mt-8 space-y-2.5 sm:space-y-3 text-sm sm:text-base">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground leading-snug">{p}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/about"
            className="mt-6 sm:mt-10 inline-flex items-center gap-2 bg-card border border-border px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold hover:bg-muted transition-colors soft-shadow text-sm sm:text-base"
          >
            <span>{isAr ? "اقرأ قصتنا" : "Read our story"}</span>
            <ArrowRight className="size-4 rtl-flip" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-7 elevated-shadow">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {cards.map((item) => (
                <div key={item.k} className="min-w-0 rounded-xl sm:rounded-2xl border border-border bg-muted/40 p-3 sm:p-5 hover:bg-muted transition-colors">
                  <div className="text-sm sm:text-lg md:text-xl font-display font-bold text-gradient truncate">{item.k}</div>
                  <div className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">{item.v}</div>
                </div>
              ))}
            </div>
            <blockquote className="mt-4 sm:mt-6 italic text-xs sm:text-sm text-muted-foreground border-s-2 border-primary ps-3 sm:ps-4 leading-relaxed">
              {isAr
                ? "«لا نصنع محتوى يُشاهد فحسب — بل نصنع محتوى يؤثر ويقنع.»"
                : '"We don\'t make content that\'s only watched — we make content that influences and convinces."'}
            </blockquote>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
