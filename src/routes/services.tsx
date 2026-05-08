import { createFileRoute } from "@tanstack/react-router";
import { Services } from "@/components/site/Services";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/services")({
  head: () => ({ meta: [{ title: "Services — SADA" }, { name: "description", content: "Content creation, branding, social media, web design, paid ads, and growth services." }] }),
  component: () => (
    <>
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">SERVICES</p>
          <h1 className="font-display text-5xl md:text-7xl font-bold">Built for <span className="text-gradient">growth</span>.</h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">A full-stack creative studio — from identity to ads, all under one roof.</p>
        </div>
      </section>
      <Services />
      <CTA />
    </>
  ),
});
