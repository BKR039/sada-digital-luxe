import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CTA } from "@/components/site/CTA";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Megaphone, Code2, Clapperboard, Users, ArrowUpRight, User } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getLocalizedDivisions } from "@/data/services";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const initialMembers = await fetchPublicTeamMembers();
    return { initialMembers };
  },
  head: () => ({
    meta: [
      { title: "About SADA — Marketing, Development & Production" },
      {
        name: "description",
        content:
          "Meet SADA, a creative company combining marketing, development and production to build brands, digital experiences and content that move businesses forward.",
      },
      { property: "og:title", content: "About SADA — Marketing, Development & Production" },
      {
        property: "og:description",
        content:
          "Meet SADA, a creative company combining marketing, development and production to build brands, digital experiences and content that move businesses forward.",
      },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

export interface PublicTeamMember {
  id: string;
  name: string;
  position: string;
  position_ar?: string | null;
  division?: string;
  specialties?: string[];
  bio?: string | null;
  bio_ar?: string | null;
  photo_url?: string | null;
  socials?: Record<string, string> | null;
  sort_order: number;
}

export async function fetchPublicTeamMembers(): Promise<PublicTeamMember[]> {
  try {
    let { data, error } = await (supabase as any)
      .from("public_team_members")
      .select("id, name, position, position_ar, division, specialties, bio, bio_ar, photo_url, socials, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data) {
      const fallback = await (supabase as any)
        .from("team_members")
        .select("id, name, position, position_ar, division, specialties, bio, bio_ar, photo_url, socials, sort_order")
        .eq("published", true)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data || data.length === 0) {
      return [];
    }

    const validMembers: PublicTeamMember[] = [];
    const seenIdentities = new Set<string>();

    for (const m of data) {
      const cleanName = (m.name || "").trim();
      const cleanPos = (m.position || "").trim();
      if (!cleanName || cleanName.includes("@") || !cleanPos) continue;

      const hasPhoto = Boolean(m.photo_url && m.photo_url.trim().length > 0);
      const hasBio = Boolean((m.bio && m.bio.trim().length > 0) || (m.bio_ar && m.bio_ar.trim().length > 0));
      const hasSpecialties = Array.isArray(m.specialties) && m.specialties.length > 0;
      const hasSocials = Boolean(m.socials && Object.keys(m.socials).length > 0);

      if (!hasPhoto && !hasBio && !hasSpecialties && !hasSocials) {
        continue;
      }

      const normKey = cleanName.toLowerCase();
      if (seenIdentities.has(normKey)) continue;
      seenIdentities.add(normKey);

      validMembers.push(m);
    }

    return validMembers;
  } catch {
    return [];
  }
}

function AboutPage() {
  const { initialMembers } = Route.useLoaderData();
  const { language } = useTranslation();
  const isAr = language === "ar";
  const divisions = getLocalizedDivisions(language);
  const [members, setMembers] = useState<PublicTeamMember[]>(initialMembers || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialMembers || initialMembers.length === 0) {
      fetchPublicTeamMembers().then((res) => {
        setMembers(res);
        setLoading(false);
      });
    }
  }, [initialMembers]);


  return (
    <>
      {/* SECTION 01 — HERO */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] sm:text-xs font-bold text-primary tracking-[0.3em] mb-2.5 sm:mb-3 inline-flex items-center gap-2 justify-center uppercase">
            <Sparkles className="size-3.5" /> {isAr ? "عن صدى" : "ABOUT SADA"}
          </p>
          <h1 className="font-display text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight text-balance">
            {isAr ? (
              <>نبني علامات تجارية، تجارب رقمية و<span className="text-gradient">محتوى يدفع الأعمال للأمام</span>.</>
            ) : (
              <>We build brands, digital experiences and <span className="text-gradient">content that move businesses forward</span>.</>
            )}
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {isAr
              ? "صدى هي شركة إبداعية تجمع بين التسويق، البرمجة، والإنتاج السينمائي لمساعدة الشركات الطموحة على بناء علامات أقوى وحضور رقمي استثنائي."
              : "SADA is a creative company combining marketing, development and production to help ambitious businesses build stronger brands and digital experiences."}
          </p>
        </div>
      </section>

      {/* SECTION 02 — WHAT SADA DOES */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
              {isAr ? "ما تقوم به صدى" : "WHAT SADA DOES"}
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">
              {isAr ? "ثلاثة تخصصات، في استوديو واحد متكامل." : "Three divisions, one studio."}
            </h2>
          </div>
          <div className="mt-8 sm:mt-12 grid md:grid-cols-3 gap-3.5 sm:gap-5">
            {divisions.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45 }}
                className="rounded-2xl sm:rounded-3xl border border-border bg-card p-5 sm:p-7 md:p-8 soft-shadow hover:elevated-shadow transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary mb-4 sm:mb-5">
                    <d.icon className="size-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight">{d.name}</h3>
                  <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                    {d.services.map((item) => (
                      <li key={item} className="text-xs sm:text-sm text-muted-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 03 — OUR VISION */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-6xl rounded-2xl sm:rounded-3xl glass-strong p-5 sm:p-10 md:p-14">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
            {isAr ? "رؤيتنا" : "OUR VISION"}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold max-w-3xl tracking-tight">
            {isAr ? "أكثر من مجرد وكالة تقليدية." : "More than an agency."}
          </h2>
          <div className="mt-4 sm:mt-6 max-w-2xl space-y-3 sm:space-y-4 text-xs sm:text-base text-muted-foreground leading-relaxed">
            <p>
              {isAr
                ? "تأسست صدى انطلاقاً من فكرة جوهرية: لا ينبغي للشركات أن تتشتت بين مسوقين، ومصممين، ومطورين، وفرق إنتاج منفصلة لبناء حضور قوي."
                : "SADA was built around a simple idea: businesses shouldn't have to coordinate between separate marketers, designers, developers and production teams to build a strong presence."}
            </p>
            <p>
              {isAr
                ? "نحن نجمع الاستراتيجية، الإبداع، التقنية، والإنتاج السينمائي تحت مظلة رؤية موحدة وهدف استثماري واضح."
                : "We bring strategy, creativity, technology and production together under one vision."}
            </p>
          </div>
          <div className="mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-border">
            <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-gradient">
              {isAr ? "التسويق × التطوير × الإنتاج" : "Marketing × Development × Production"}
            </p>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
              {isAr ? "← منظومة إبداعية واحدة متصلة." : "→ One creative ecosystem."}
            </p>
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 inline-flex items-center gap-2 uppercase">
              <Users className="size-3.5" /> {isAr ? "فريق العمل" : "THE TEAM"}
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">
              {isAr ? "تعرّف على الفريق." : "Meet the team."}
            </h2>
            <p className="mt-2 sm:mt-3 text-xs sm:text-base text-muted-foreground">
              {isAr ? "العقول المبدعة التي تصنع هوية صدى وتدير مشاريعها." : "The people building SADA."}
            </p>
          </div>

          <div className="mt-8 sm:mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4 sm:p-6 animate-pulse">
                  <div className="size-12 sm:size-14 rounded-xl bg-muted/40 mb-4 sm:mb-5" />
                  <div className="h-5 w-3/4 bg-muted/40 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-muted/30 rounded mb-3" />
                  <div className="h-3 w-full bg-muted/20 rounded" />
                </div>
              ))
            ) : members.length > 0 ? (
              members.map((m) => {
                const linkedinUrl = m.socials?.linkedin;
                const behanceUrl = m.socials?.behance;
                const instagramUrl = m.socials?.instagram;

                const targetUrl = linkedinUrl || behanceUrl || instagramUrl || "#";
                const platformLabel = linkedinUrl
                  ? "LinkedIn"
                  : behanceUrl
                  ? "Behance"
                  : instagramUrl
                  ? "Instagram"
                  : isAr ? "فريق صدى" : "SADA Team";

                const positionText = isAr && m.position_ar ? m.position_ar : m.position;
                const bioText = isAr && m.bio_ar ? m.bio_ar : m.bio;

                const specialtiesText = m.specialties && m.specialties.length > 0
                  ? m.specialties.join(" · ")
                  : bioText || m.division || (isAr ? "خبير إبداعي" : "Creative Specialist");

                return (
                  <a
                    key={m.id}
                    href={targetUrl !== "#" ? targetUrl : undefined}
                    target={targetUrl !== "#" ? "_blank" : undefined}
                    rel={targetUrl !== "#" ? "noopener noreferrer" : undefined}
                    aria-label={`Visit ${m.name} on ${platformLabel}`}
                    className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {m.photo_url ? (
                      <img
                        src={m.photo_url}
                        alt={m.name}
                        className="size-14 rounded-xl object-cover ring-2 ring-primary/20 group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="size-14 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary group-hover:scale-105 transition-transform duration-200">
                        <User className="size-6" aria-hidden="true" />
                      </div>
                    )}

                    <div className="mt-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-display text-lg font-bold">{m.name}</div>
                        <div className="text-sm text-primary font-medium mt-0.5">{positionText}</div>
                        <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{specialtiesText}</div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors duration-200">
                        <span>{platformLabel}</span>
                        <ArrowUpRight
                          className="size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl-flip transition-transform duration-200"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </a>
                );
              })
            ) : null}
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}
