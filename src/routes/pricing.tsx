import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Sparkles, ArrowRight, ShieldCheck, HelpCircle, Layers, Zap, Star } from "lucide-react";
import { useTranslation } from "@/i18n";
import { fetchPublicPackages, fetchPackageAddons } from "@/lib/package-service";
import type { CategoryWithPackages, PackageAddon, PackageCatalogItem } from "@/types/package-catalog";
import { PublicPackageCard } from "@/components/packages/PublicPackageCard";
import { PackageDetailsModal } from "@/components/packages/PackageDetailsModal";
import { formatPackageNumber } from "@/components/packages/package-utils";

import { Skeleton } from "@/components/ui/sada-ui";

export const Route = createFileRoute("/pricing")({
  loader: async () => {
    try {
      const [categoriesWithPackages, addons] = await Promise.all([
        fetchPublicPackages(),
        fetchPackageAddons(true),
      ]);
      return { categoriesWithPackages, addons };
    } catch (e) {
      console.error("Pricing loader error:", e);
      return { categoriesWithPackages: [], addons: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Pricing & Package Catalog — SADA Creative Agency" },
      {
        name: "description",
        content:
          "Official SADA Package Catalog. Transparent retainers and production units for social media, video shooting, paid ads, and digital systems in Tunisia.",
      },
      { property: "og:title", content: "Pricing & Package Catalog — SADA Creative Agency" },
      {
        property: "og:description",
        content:
          "Official SADA Package Catalog with transparent pricing for social media management, content production, paid ads, and custom digital systems.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "How fast can we start?",
    a: "Most engagements kick off within 5–7 business days of contract signature, starting with a 1-hour discovery and content planning session.",
  },
  {
    q: "Do you offer custom packages?",
    a: "Yes. Roughly half our clients run a custom blend of services (Build Your Package CUS-01). Tell us about your goals and we'll send a tailored scope and quote.",
  },
  {
    q: "What's the typical engagement length?",
    a: "All SADA monthly retainers run as rolling monthly retainers with a recommended 3-month cycle, so we can build momentum and prove measurable growth.",
  },
  {
    q: "Do package prices include ad spend?",
    a: "No — ad spend / sponsoring budget is 100% separate from package fees and is paid directly to advertising platforms (Meta, TikTok, Google).",
  },
  {
    q: "Can you work with our in-house team?",
    a: "Absolutely. We regularly plug into internal marketing teams as a dedicated creative production studio or digital growth engine.",
  },
];

const FAQ_AR = [
  {
    q: "ما هي السرعة التي يمكننا بها بدء العمل؟",
    a: "تبدأ معظم المشاريع خلال 5 إلى 7 أيام عمل من توقيع الاتفاقية، بجلسة استكشافية وتخطيطية مدتها ساعة لتحديد الأولويات بدقة.",
  },
  {
    q: "هل توفرون باقات مخصصة حسب احتياجاتنا؟",
    a: "نعم بكل تأكيد. نوفر باقة 'صمم باقتك الخاصة CUS-01' لجمع أي توليفة مخصصة من الإنتاج والإدارة والإعلانات والمواقع حسب ميزانيتك وأهدافك.",
  },
  {
    q: "ما هي المدة المعتادة للتعاقد؟",
    a: "تعمل باقات صدى الشهرية كاشتراكات مستمرة بدورة موصى بها 3 أشهر، لضمان بناء تراكم إبداعي وتحقيق نتائج تسويقية قابلة للقياس.",
  },
  {
    q: "هل تشمل الأسعار ميزانية الحملات الإعلانية الممولة؟",
    a: "لا — ميزانية الإعلانات الممولة (السبونسورينغ) مستقلة تماماً عن أتعاب الباقات، وتُدفع مباشرة لمنصات الإعلانات (ميتا، تيك توك، جوجل).",
  },
  {
    q: "هل يمكنكم العمل بالتعاون مع فريقنا الداخلي؟",
    a: "بالتأكيد. غالباً ما ننضم لفرق التسويق الداخلية كذراع إبداعي أو محرك نمو متقدم يساند فريقك ويضاعف كفاءته.",
  },
];

function PricingPage() {
  const loaderData = Route.useLoaderData();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const faqList = isAr ? FAQ_AR : FAQ;

  const [categories, setCategories] = useState<CategoryWithPackages[]>(
    loaderData?.categoriesWithPackages || []
  );
  const [addons, setAddons] = useState<PackageAddon[]>(loaderData?.addons || []);
  const [loading, setLoading] = useState(categories.length === 0);
  const [selectedDetailsPkg, setSelectedDetailsPkg] = useState<PackageCatalogItem | null>(null);

  useEffect(() => {
    if (categories.length === 0) {
      setLoading(true);
      Promise.all([fetchPublicPackages(), fetchPackageAddons(true)])
        .then(([cats, adds]) => {
          setCategories(cats);
          setAddons(adds);
        })
        .finally(() => setLoading(false));
    }
  }, []);

  return (
    <div className="relative px-3.5 sm:px-4 py-8 sm:py-14 md:py-20 max-w-7xl mx-auto space-y-10 sm:space-y-16 md:space-y-24 overflow-hidden">
      {/* SADA Atmospheric Soft Blue Background Diffusion */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] max-w-[200vw] h-[600px] bg-[radial-gradient(ellipse_at_center,oklch(0.66_0.22_250_/_0.08),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_center,oklch(0.82_0.18_220_/_0.12),transparent_70%)] blur-3xl -z-10"
        aria-hidden="true"
      />

      {/* 1. HERO SECTION */}
      <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4 min-w-0">
        <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary uppercase">
          {isAr ? "دليل باقات صدى الرسمي" : "SADA OFFICIAL PACKAGE CATALOG"}
        </p>
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.12] tracking-tight text-balance">
          {isAr ? (
            <>
              أسعار شفافة <span className="text-gradient">لنتائج استثنائية</span>.
            </>
          ) : (
            <>
              Clear pricing for <span className="text-gradient">proven outcomes</span>.
            </>
          )}
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          {isAr
            ? "منظومة باقات معيارية موحدة تغطي إدارة السوشيال ميديا، الإنتاج والتصوير، الإعلانات الممولة والمواقع الرقمية. مخرجات محددة ونتائج قابلة للقياس دون التزامات غامضة."
            : "Standardized canonical retainers and production units for social media, professional shooting, paid acquisition and digital platforms. Defined outcomes, zero vague promises."}
        </p>

        {/* Core invariant banner */}
        <div className="pt-1.5 sm:pt-2">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] sm:text-xs text-foreground font-medium max-w-full text-center">
            <span className="size-2 rounded-full bg-primary shrink-0 animate-pulse" />
            <span className="leading-tight">
              {isAr
                ? "ميزانية الإعلانات الممولة (السبونسورينغ) مستقلة تماماً عن أتعاب الباقات"
                : "Sponsoring / Ad Budget is strictly separate from package prices"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CATEGORIES AND 3-COLUMN COMFORTABLE CARDS GRID */}
      {loading ? (
        <div className="space-y-12" role="status" aria-busy="true">
          <span className="sr-only">
            {isAr ? "جاري تحميل دليل الباقات..." : "Loading SADA Package Catalog..."}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="sada-pricing-card rounded-3xl p-6 sm:p-7 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-7 w-3/4 rounded-xl" />
                  <Skeleton className="h-4 w-full rounded-md" />
                </div>
                <div className="pt-4 border-t border-border/70 space-y-2">
                  <Skeleton className="h-9 w-36 rounded-xl" />
                  <Skeleton className="h-3.5 w-44 rounded-md" />
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 grid grid-cols-3 gap-2">
                  <Skeleton className="h-7 rounded-xl" />
                  <Skeleton className="h-7 rounded-xl" />
                  <Skeleton className="h-7 rounded-xl" />
                </div>
                <div className="space-y-2.5">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-4 rounded-md" />
                    <Skeleton className="h-4 rounded-md" />
                    <Skeleton className="h-4 rounded-md" />
                    <Skeleton className="h-4 rounded-md" />
                  </div>
                </div>
                <div className="pt-4 border-t border-border/70">
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : categories.filter((cat) => cat.packages && cat.packages.length > 0).length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-border bg-card/60 backdrop-blur-md p-5 sm:p-10 text-center max-w-3xl mx-auto space-y-4 sm:space-y-6 elevated-shadow">
          <div className="size-11 sm:size-14 rounded-xl sm:rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto border border-primary/20">
            <Sparkles className="size-5 sm:size-7" />
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase font-bold tracking-wider px-2.5 sm:px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 inline-block">
              {isAr ? "دليل موسم 2026 قيد المراجعة الإدارية" : "2026 Catalog Executive Review"}
            </span>
            <h3 className="text-lg sm:text-2xl font-bold font-display text-foreground leading-snug">
              {isAr ? "باقات مخصصة واستشارات استراتيجية مباشرة" : "Bespoke Engagements & Strategic Consultation"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              {isAr
                ? "تخضع باقاتنا العامة المعيارية لمراجعة الحوكمة السنوية لضمان مطابقة معايير الجودة والتسعير المعتمد. تظل الحلول المخصصة ونموذج 'صمم باقتك CUS-01' متاحة بالكامل لجميع العملاء عبر الاستشارة المباشرة."
                : "Our standardized public packages are currently undergoing annual executive governance review to ensure strict deliverable excellence. In the meantime, tailored retainers and our complete Build Your Package (CUS-01) model remain fully operational via direct consultation."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2">
            <Link
              to="/contact"
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 transition-all inline-flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{isAr ? "طلب استشارة وباقة مخصصة (CUS-01)" : "Request Custom Proposal (CUS-01)"}</span>
              <ArrowRight className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
            <a
              href="https://wa.me/21699999999"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-border bg-card text-foreground font-semibold text-xs sm:text-sm hover:bg-muted transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>{isAr ? "تواصل عبر واتساب" : "WhatsApp Concierge"}</span>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-20">
          {categories
            .filter((cat) => cat.packages && cat.packages.length > 0)
            .map((cat) => (
              <section key={cat.id} className="space-y-8" id={cat.slug}>
                {/* Category Header */}
                <div className="border-b border-border/80 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {cat.code}
                      </span>
                      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                        {isAr ? cat.name_ar || cat.name : cat.name}
                      </h2>
                    </div>
                    {(cat.description || cat.description_ar) && (
                      <p className="mt-1 text-sm text-muted-foreground max-w-3xl leading-relaxed">
                        {isAr ? cat.description_ar || cat.description : cat.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {cat.packages.length} {isAr ? "باقة" : "packages"}
                  </span>
                </div>

                {/* 3 Cards Per Row Responsive Grid (Wider, Shorter, Balanced Hierarchy) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
                  {cat.packages.map((pkg, pkgIdx) => (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: pkgIdx * 0.05, duration: 0.3 }}
                      className="flex"
                    >
                      <PublicPackageCard
                        package={pkg}
                        onViewDetails={(p) => setSelectedDetailsPkg(p)}
                        className="w-full"
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {/* 3. ADD-ONS CATALOG SECTION */}
      {addons.length > 0 && (
        <section className="space-y-8 pt-12 border-t border-border">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              {isAr ? "الوحدات الإضافية" : "OFFICIAL ADD-ONS"}
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {isAr ? "خدمات ووحدات إنتاج إضافية" : "Production Units & Add-on Services"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "يمكن طلب أي وحدة إضافية بجانب باقتك الشهرية لزيادة حجم المخرجات أو تسريع التسليم."
                : "Add individual deliverables, extra shooting hours or express turnarounds onto any active engagement."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addons.map((add) => (
              <div
                key={add.id}
                className="p-5 rounded-2xl border border-border bg-card shadow-xs flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">
                      {add.code}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">
                      {isAr ? add.name_ar || add.name : add.name}
                    </h4>
                  </div>
                  {(add.description || add.description_ar) && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {isAr ? add.description_ar || add.description : add.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-base font-bold text-primary" dir="ltr">
                    {add.percentage_modifier
                      ? `+${add.percentage_modifier}%`
                      : `${formatPackageNumber(add.price)} TND`}
                  </div>
                  <span className="text-[10px] text-muted-foreground block capitalize">
                    {add.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. FAQ SECTION */}
      <section className="space-y-8 pt-12 border-t border-border max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {isAr ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "إجابات مباشرة وشفافة حول كيفية عمل باقات وشراكات صدى."
              : "Clear, direct answers about working with SADA."}
          </p>
        </div>

        <div className="space-y-4">
          {faqList.map((item, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-2"
            >
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>{item.q}</span>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed ps-6">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FINAL CALL TO ACTION */}
      <section className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 text-center space-y-5 max-w-4xl mx-auto elevated-shadow">
        <h2 className="text-2xl md:text-4xl font-bold text-foreground">
          {isAr ? "جاهز لبناء شراكة إبداعية حقيقية؟" : "Ready to build measurable brand momentum?"}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {isAr
            ? "تحدث معنا اليوم لنحدد الباقة الأنسب لأهدافك وميزانيتك، أو نصمم لك باقة مخصصة بالكامل."
            : "Talk to us today. We'll identify the best package for your objectives or engineer a custom scope for your brand."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/contact"
            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 shadow-md inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>{isAr ? "ابدأ المحادثة الآن" : "Start with SADA"}</span>
            <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
          </Link>
          <Link
            to="/case-studies"
            className="px-6 py-3 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted whitespace-nowrap shrink-0"
          >
            {isAr ? "استعرض أعمالنا السابقة" : "Explore Case Studies"}
          </Link>
        </div>
      </section>

      {/* 6. PACKAGE FULL DETAILS MODAL */}
      <PackageDetailsModal
        package={selectedDetailsPkg}
        open={Boolean(selectedDetailsPkg)}
        onOpenChange={(open) => !open && setSelectedDetailsPkg(null)}
      />
    </div>
  );
}
