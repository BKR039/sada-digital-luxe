import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { PrimaryCTA } from "./PrimaryCTA";
import { useTranslation } from "@/i18n";
import { fetchSiteKpis, SiteKpi, DEFAULT_HERO_PROOFS } from "@/lib/site-content-service";
import { DynamicIcon } from "@/components/common/DynamicIcon";

import imgScript from "@/assets/hero-image3.webp";
import imgProduction from "@/assets/hero-image1.webp";
import imgEditing from "@/assets/hero-image2.webp";
import imgAgreement from "@/assets/hero-image4.webp";

/**
 * Homepage hero. Scoped styling lives in `.sada-hero` in `src/styles.css`.
 * Seamlessly integrates with the fixed site navbar in one continuous dark canvas.
 */
export function Hero() {
  const { t, language } = useTranslation();
  const isAr = language === "ar";
  const [kpis, setKpis] = useState<SiteKpi[]>(DEFAULT_HERO_PROOFS);

  useEffect(() => {
    let isMounted = true;
    fetchSiteKpis("hero_proof").then((data) => {
      if (isMounted && data && data.length > 0) {
        setKpis(data.filter((k) => k.is_active));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const cards = [
    {
      number: "01",
      title: t("hero.card1Label"),
      copy: t("hero.card1Desc"),
      image: imgScript,
      alt: "SADA script writing, concept notes and creative planning",
    },
    {
      number: "02",
      title: t("hero.card2Label"),
      copy: t("hero.card2Desc"),
      image: imgProduction,
      alt: "SADA cinema camera filming video production on set",
    },
    {
      number: "03",
      title: t("hero.card3Label"),
      copy: t("hero.card3Desc"),
      image: imgEditing,
      alt: "SADA editing suite with dual monitors and color timeline",
    },
    {
      number: "04",
      title: t("hero.card4Label"),
      copy: t("hero.card4Desc"),
      image: imgAgreement,
      alt: "SADA client project agreement proposal and partnership handshake",
    },
  ];

  const proof = kpis.map((k) => ({
    key: k.id || k.metric_key,
    value: `${k.prefix || ""}${k.value}${k.suffix || ""}`,
    label: isAr ? k.label_ar : k.label_en,
    icon: k.icon,
  }));

  return (
    <section className="sada-hero" aria-labelledby="sada-headline">
      <div className="sada-atmosphere" aria-hidden="true" />
      <div className="sada-grid" aria-hidden="true" />

      <div className="sada-copy">
        <p className="sada-eyebrow entrance entrance-eyebrow">{t("hero.eyebrow")}</p>

        <h1 id="sada-headline" className="sada-headline entrance entrance-headline">
          {t("hero.headlineStart")}
          <br />
          <span className="text-gradient">{t("hero.headlineHighlight")}</span>
        </h1>

        <p className="sada-description entrance entrance-description">
          {t("hero.subtitle")}
        </p>

        <p className="sada-services entrance entrance-description">
          {t("hero.servicesTagline")}
        </p>

        <div className="sada-ctas entrance entrance-ctas">
          <PrimaryCTA to="/contact" size="lg">
            {t("hero.ctaPrimary")}
          </PrimaryCTA>
          <Link className="sada-secondary-cta" to="/case-studies">
            {t("hero.ctaSecondary")}
          </Link>
        </div>

        <p className="sada-reassurance entrance entrance-ctas">
          {t("hero.reassurance")}
        </p>
      </div>

      <div className="sada-showcase">
        <div className="sada-card-grid" role="list" aria-label="SADA creative process and work">
          {cards.map(({ number, title, copy, image, alt }, index) => (
            <article
              key={number}
              role="listitem"
              className="sada-card entrance entrance-card"
              style={{ "--card-index": index } as CSSProperties}
            >
              <div className="sada-card-visual">
                <img
                  src={image}
                  alt={alt}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="sada-card-img"
                />
                <div className="sada-card-scrim" aria-hidden="true" />
              </div>
              <div className="sada-card-body">
                <span className="sada-card-number">{number}</span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>

        <ul className="sada-proof entrance entrance-proof">
          {proof.map(({ key, value, label, icon }) => (
            <li key={key} className="group transition-all">
              <strong className="inline-flex items-center gap-1.5">
                {icon && <DynamicIcon name={icon} className="size-4 text-primary shrink-0 transition-transform group-hover:scale-110" />}
                <span>{value}</span>
              </strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

