import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import {
  fetchTrustedPartners,
  fetchContentSection,
  TrustedPartner,
  DEFAULT_PARTNERS,
} from "@/lib/site-content-service";

export function TrustedBy() {
  const { t, language } = useTranslation();
  const isAr = language === "ar";

  const [partners, setPartners] = useState<TrustedPartner[]>(DEFAULT_PARTNERS);
  const [sectionTitle, setSectionTitle] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    // Fetch partners
    fetchTrustedPartners(true).then((data) => {
      if (isMounted && data && data.length > 0) {
        setPartners(data);
      }
    });

    // Fetch custom section title
    fetchContentSection("trusted_by").then((sec) => {
      if (isMounted && sec) {
        setSectionTitle(isAr ? sec.title_ar : sec.title_en);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAr]);

  const displayTitle = sectionTitle || t("trustedBy.title");

  return (
    <section className="px-4 py-12 md:py-16 border-y border-border bg-card/60 dark:bg-muted/30 relative overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-xs font-bold tracking-[0.25em] text-muted-foreground uppercase mb-6 sm:mb-8">
          {displayTitle}
        </p>

        {/* Centered single-line / fluid-row partners layout */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-10 lg:gap-x-12 gap-y-4">
          {partners.map((partner, index) => {
            const hasLink = Boolean(partner.website_url && partner.website_url.trim().length > 0);

            const content = (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
                className={`group relative flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 ${
                  hasLink
                    ? "cursor-pointer hover:bg-muted/80 hover:shadow-xs hover:-translate-y-0.5"
                    : "cursor-default"
                }`}
                title={partner.hover_description || partner.name}
              >
                {partner.logo_url ? (
                  <div className="h-8 sm:h-9 w-auto max-w-[120px] flex items-center justify-center">
                    <img
                      src={partner.logo_url}
                      alt={partner.name}
                      className="max-h-full max-w-full object-contain filter grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <span className="whitespace-nowrap text-center text-sm sm:text-base font-display font-semibold tracking-wide text-foreground/85 dark:text-muted-foreground/80 group-hover:text-primary dark:group-hover:text-cyan-400 transition-colors">
                    {partner.name}
                  </span>
                )}

                {hasLink && (
                  <div className="absolute top-1 end-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="size-2.5 text-primary" />
                  </div>
                )}

                {partner.hover_description && (
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-popover text-popover-foreground px-2 py-0.5 rounded shadow border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {partner.hover_description}
                  </span>
                )}
              </motion.div>
            );

            if (hasLink) {
              return (
                <a
                  key={partner.id || partner.name}
                  href={partner.website_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-xl"
                  aria-label={`${partner.name} partner link`}
                >
                  {content}
                </a>
              );
            }

            return <div key={partner.id || partner.name} className="inline-block">{content}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
