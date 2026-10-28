import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Hero } from "@/components/site/Hero";
import { TrustedBy } from "@/components/site/TrustedBy";
import { Stats } from "@/components/site/Stats";
import { Services } from "@/components/site/Services";

const ReelsShowcase = lazy(() => import("@/components/home/ReelsShowcase").then(m => ({ default: m.ReelsShowcase })));
const FeaturedProjects = lazy(() => import("@/components/site/FeaturedProjects").then(m => ({ default: m.FeaturedProjects })));
const About = lazy(() => import("@/components/site/About").then(m => ({ default: m.About })));
const Testimonials = lazy(() => import("@/components/site/Testimonials").then(m => ({ default: m.Testimonials })));
const CTA = lazy(() => import("@/components/site/CTA").then(m => ({ default: m.CTA })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SADA — Where Real Identity Begins" },
      { name: "description", content: "Creative digital agency. Branding, content creation, social growth, web design, and paid ads — built to be noticed." },
    ],
  }),
  component: Index,
});

const SectionSkeleton = () => (
  <div className="py-12 sm:py-16 px-4 max-w-7xl mx-auto animate-pulse opacity-40">
    <div className="h-6 w-36 bg-muted rounded-full mx-auto mb-4" />
    <div className="h-10 w-72 bg-muted rounded-xl mx-auto mb-8" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-48 bg-muted/60 rounded-3xl" />
      <div className="h-48 bg-muted/60 rounded-3xl hidden md:block" />
      <div className="h-48 bg-muted/60 rounded-3xl hidden md:block" />
    </div>
  </div>
);

function Index() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <Stats />
      <Services />
      <Suspense fallback={<SectionSkeleton />}><ReelsShowcase /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><FeaturedProjects /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><About /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Testimonials /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><CTA /></Suspense>
    </>
  );
}
