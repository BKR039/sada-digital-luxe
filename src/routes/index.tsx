import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Hero } from "@/components/site/Hero";

const Stats = lazy(() => import("@/components/site/Stats").then(m => ({ default: m.Stats })));
const TrustedBy = lazy(() => import("@/components/site/TrustedBy").then(m => ({ default: m.TrustedBy })));
const Services = lazy(() => import("@/components/site/Services").then(m => ({ default: m.Services })));
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

const Fallback = () => <div className="h-16" />;

function Index() {
  return (
    <>
      <Hero />
      <Suspense fallback={<Fallback />}><TrustedBy /></Suspense>
      <Suspense fallback={<Fallback />}><Stats /></Suspense>
      <Suspense fallback={<Fallback />}><Services /></Suspense>
      <Suspense fallback={<Fallback />}><FeaturedProjects /></Suspense>
      <Suspense fallback={<Fallback />}><About /></Suspense>
      <Suspense fallback={<Fallback />}><Testimonials /></Suspense>
      <Suspense fallback={<Fallback />}><CTA /></Suspense>
    </>
  );
}
