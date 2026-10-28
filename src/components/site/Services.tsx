import { motion } from "framer-motion";
import { Camera, ThumbsUp, MonitorSmartphone, Megaphone, Lightbulb, Video, ArrowRight, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";

export function Services() {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const services: { title: string; desc: string; Icon: LucideIcon }[] = [
    {
      title: isAr ? "صناعة المحتوى" : "Content Creation",
      desc: isAr ? "تصوير فوتوغرافي، فيديو ومحتوى قصير مصمم لخطف الأنظار." : "Photography, video & short-form built to stop the scroll.",
      Icon: Camera,
    },
    {
      title: isAr ? "بناء الهوية" : "Branding",
      desc: isAr ? "أنظمة هوية بصرية تكتسب الثقة وتبرز علامتك في السوق." : "Identity systems that earn trust and stand out in your market.",
      Icon: Lightbulb,
    },
    {
      title: isAr ? "منظومة التواصل الاجتماعي" : "Social Media",
      desc: isAr ? "استراتيجية، صناعة محتوى ونمو مستمر — منظومة تشغيل اجتماعية متكاملة." : "Strategy, posting and growth — a complete social operating system.",
      Icon: ThumbsUp,
    },
    {
      title: isAr ? "تصميم وتطوير المواقع" : "Web Design",
      desc: isAr ? "مواقع رقمية حديثة وفائقة السرعة مهيأة لتحويل الزوار إلى عملاء دائمين." : "Modern, premium sites engineered to convert visitors into clients.",
      Icon: MonitorSmartphone,
    },
    {
      title: isAr ? "الإعلانات الممولة" : "Paid Ads",
      desc: isAr ? "حملات أداء مدروسة على ميتا وتيك توك — تتبع دقيق وتحسين مستمر للنتائج." : "Meta & TikTok performance campaigns — tracked, optimized, scaled.",
      Icon: Megaphone,
    },
    {
      title: isAr ? "الإنتاج المرئي والسينمائي" : "Video Production",
      desc: isAr ? "جلسات تصوير سينمائية، مونتاج راقٍ وريلز تحقق أعلى نسب التفاعل." : "Cinematic shoots, premium edits and reels that perform.",
      Icon: Video,
    },
  ];

  return (
    <section className="relative py-12 sm:py-16 md:py-20 px-3.5 sm:px-4">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-14 max-w-2xl mx-auto"
        >
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2.5 sm:mb-3 uppercase">
            {isAr ? "خدماتنا الإبداعية" : "OUR SERVICES"}
          </p>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">
            {isAr ? (
              <>كل ما تحتاجه علامتك <span className="text-gradient">لتنمو وتزدهر.</span></>
            ) : (
              <>Everything your brand needs <span className="text-gradient">to grow.</span></>
            )}
          </h2>
          <p className="mt-2.5 sm:mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {isAr
              ? "استوديو رقمي وإبداعي متكامل للعلامات التي ترفض أن تمر مرور الكرام."
              : "An end-to-end studio for brands that want to be seen, heard and remembered."}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              className="group relative rounded-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-6 md:p-7 soft-shadow hover:-translate-y-1 hover:elevated-shadow transition-all flex flex-col justify-between"
            >
              <div>
                <div className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-primary grid place-items-center neon-glow">
                  <s.Icon className="size-5 sm:size-6 text-white" />
                </div>
                <h3 className="mt-3.5 sm:mt-5 text-base sm:text-lg font-bold text-foreground tracking-tight">{s.title}</h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              <div className="mt-3.5 sm:mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors">
                <span>{isAr ? "اعرف المزيد" : "Learn more"}</span>
                <ArrowRight className="size-3.5 rtl-flip group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
