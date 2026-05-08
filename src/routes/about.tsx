import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/components/site/About";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — SADA" }, { name: "description", content: "Meet SADA — a digital agency where real identity begins." }] }),
  component: () => (
    <>
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">ABOUT</p>
          <h1 className="font-display text-5xl md:text-7xl font-bold">A studio for <span className="text-gradient">brands that matter</span>.</h1>
        </div>
      </section>
      <About />
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl grid md:grid-cols-3 gap-5">
          {[
            { t: "Mission", d: "Make every brand we touch unforgettable through content, story and craft." },
            { t: "Vision", d: "Set a new bar for creative work coming out of the region — premium, intentional, modern." },
            { t: "Why SADA", d: "Strategy first. Beautiful execution second. Real numbers third. Always all three." },
          ].map((b) => (
            <div key={b.t} className="glass glow-border rounded-3xl p-7">
              <div className="text-xs font-bold text-accent tracking-widest mb-2">{b.t.toUpperCase()}</div>
              <p className="text-foreground/90">{b.d}</p>
            </div>
          ))}
        </div>
      </section>
      <CTA />
    </>
  ),
});
