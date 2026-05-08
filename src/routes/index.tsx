import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Services } from "@/components/site/Services";
import { FeaturedProjects } from "@/components/site/FeaturedProjects";
import { About } from "@/components/site/About";
import { Testimonials } from "@/components/site/Testimonials";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SADA — Where Real Identity Begins" },
      { name: "description", content: "Creative digital agency. Branding, content creation, social growth, web design, and paid ads — built to be noticed." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <Services />
      <FeaturedProjects />
      <About />
      <Testimonials />
      <CTA />
    </>
  );
}
