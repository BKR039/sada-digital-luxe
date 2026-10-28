import { createFileRoute } from "@tanstack/react-router";
import { SmartMatcherShell } from "@/components/contact/SmartMatcherShell";

export interface ContactSearchParams {
  package?: string;
}

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>): ContactSearchParams => {
    return {
      package: typeof search.package === "string" ? search.package : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Smart Package Matcher & Contact — SADA Creative Agency" },
      {
        name: "description",
        content:
          "Find the right SADA package for your business. Adaptive smart matching questionnaire, quick recommendation, or direct package selection.",
      },
      { property: "og:title", content: "Smart Package Matcher & Contact — SADA Creative Agency" },
      {
        property: "og:description",
        content:
          "Answer a few questions to get a personalized package recommendation tailored to your growth goals, content needs, and budget.",
      },
    ],
  }),
  component: ContactRouteComponent,
});

function ContactRouteComponent() {
  const { package: packageParam } = Route.useSearch();

  return (
    <section className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <SmartMatcherShell initialPackageParam={packageParam} />
      </div>
    </section>
  );
}
