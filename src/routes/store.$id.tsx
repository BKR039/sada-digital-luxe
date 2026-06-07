import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ShoppingBag, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  thumbnail_url: string | null;
  gumroad_url: string | null;
  category: string | null;
}

export const Route = createFileRoute("/store/$id")({
  component: ProductPage,
});

const DEFAULT_FEATURES = [
  "Instant download after purchase",
  "Lifetime free updates",
  "Commercial license included",
  "Step-by-step setup guide",
  "Premium customer support",
  "Mobile & desktop optimized",
];

const DEFAULT_FAQ = [
  { q: "How do I receive the product?", a: "Right after checkout, you'll get an instant download link by email and on the order page. You can re-download anytime from your account." },
  { q: "Can I use this commercially?", a: "Yes. Every purchase includes a commercial license for use across client and brand projects." },
  { q: "Do I get future updates?", a: "Lifetime updates are included. Whenever we release a new version you'll receive it for free." },
  { q: "What's the refund policy?", a: "If the product isn't a fit, contact us within 14 days for a full refund — no questions asked." },
];

function ProductPage() {
  const { id } = Route.useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        setProduct((data as Product) || null);
        setLoading(false);
        if (data) {
          supabase
            .from("products")
            .select("*")
            .eq("published", true)
            .neq("id", id)
            .order("sort_order")
            .limit(3)
            .then(({ data: rel }) => setRelated((rel as Product[]) || []));
        }
      });
  }, [id]);

  if (loading) {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!product) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold">Product not found</h1>
          <Link to="/store" className="mt-4 inline-flex items-center gap-2 text-primary">
            ← Back to products
          </Link>
        </div>
      </div>
    );
  }

  const priceLabel = product.price
    ? `${product.currency || "USD"} ${Number(product.price).toFixed(0)}`
    : "Free";

  return (
    <article className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Link to="/store" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="size-4" /> Back to products
        </Link>

        {/* Hero */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="rounded-3xl overflow-hidden border border-border bg-card elevated-shadow aspect-[4/3]">
            {product.thumbnail_url ? (
              <SmartMedia src={product.thumbnail_url} className="w-full h-full" autoplay={false} />
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                <ShoppingBag className="size-16 text-primary/60" />
              </div>
            )}
          </div>

          <div>
            {product.category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] uppercase text-primary">
                <Sparkles className="size-3.5" /> {product.category}
              </span>
            )}
            <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-[1.1]">{product.title}</h1>
            {product.description && (
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
              </div>
              <span>Trusted by 500+ brands</span>
            </div>

            <div className="mt-8 p-6 rounded-2xl border border-border bg-card soft-shadow">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">One-time price</div>
                  <div className="text-3xl font-display font-bold">{priceLabel}</div>
                </div>
                <a
                  href={product.gumroad_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.03] transition-transform"
                >
                  Get it now <ArrowUpRight className="size-4" />
                </a>
              </div>
              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEFAULT_FEATURES.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="mt-20 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h2 className="text-2xl md:text-3xl font-bold">Product overview</h2>
              <p className="mt-4 text-foreground/85 leading-relaxed">
                {product.description || product.title} — designed by working creatives at SADA. Every asset, template and resource is built from real client work, then refined into a system anyone can use to ship faster without sacrificing quality.
              </p>
              <p className="mt-4 text-foreground/85 leading-relaxed">
                Whether you're a founder, a small team, or a freelance creative, this product gives you the same playbook our studio uses on premium engagements — without the agency price tag.
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold">What's included</h2>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                {DEFAULT_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="size-8 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Check className="size-4" />
                    </div>
                    <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold">Benefits</h2>
              <div className="mt-6 grid sm:grid-cols-3 gap-4">
                {[
                  { k: "Ship faster", v: "Skip weeks of setup with a battle-tested system." },
                  { k: "Look premium", v: "Design language used by leading modern brands." },
                  { k: "Stay consistent", v: "Templates keep your brand on-message everywhere." },
                ].map((b) => (
                  <div key={b.k} className="rounded-2xl border border-border p-5 bg-card">
                    <div className="text-sm font-bold text-gradient">{b.k}</div>
                    <div className="text-sm text-muted-foreground mt-1.5">{b.v}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold">What people say</h2>
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                {[
                  { n: "Layla R.", r: "Founder", q: "Cut our launch prep in half. The templates feel like a real studio shipped them." },
                  { n: "Omar T.", r: "Creative Director", q: "Cleanest brand system I've bought. Every file is exactly where you'd expect." },
                ].map((t) => (
                  <div key={t.n} className="rounded-2xl border border-border p-5 bg-card">
                    <div className="flex gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
                    </div>
                    <p className="mt-3 text-sm text-foreground/90 leading-relaxed">"{t.q}"</p>
                    <div className="mt-3 text-xs text-muted-foreground">{t.n} — {t.r}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold">Frequently asked</h2>
              <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                {DEFAULT_FAQ.map((f, i) => (
                  <button
                    key={f.q}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full text-left px-5 py-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-sm">{f.q}</span>
                      <span className={`text-primary text-xl leading-none transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                    </div>
                    {openFaq === i && (
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Sticky buy column */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-border bg-card p-6 elevated-shadow">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Get the product</div>
              <div className="mt-1 text-2xl font-display font-bold">{priceLabel}</div>
              <a
                href={product.gumroad_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
              >
                Buy now <ArrowUpRight className="size-4" />
              </a>
              <Link
                to="/contact"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-semibold"
              >
                Talk to the team
              </Link>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {DEFAULT_FEATURES.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20">
            <h3 className="text-2xl md:text-3xl font-bold">Related products</h3>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to="/store/$id"
                  params={{ id: r.id }}
                  className="group block rounded-2xl overflow-hidden border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {r.thumbnail_url ? (
                      <SmartMedia src={r.thumbnail_url} className="w-full h-full transition-transform duration-500 group-hover:scale-105" autoplay={false} />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <ShoppingBag className="size-10 text-primary/60" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {r.category && (
                      <div className="text-[10px] uppercase tracking-widest text-primary mb-1">{r.category}</div>
                    )}
                    <div className="font-bold group-hover:text-primary transition-colors">{r.title}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {r.price ? `${r.currency || "USD"} ${Number(r.price).toFixed(0)}` : "Free"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Final CTA */}
        <div className="mt-20 rounded-3xl glass-strong p-10 text-center">
          <h3 className="text-2xl md:text-3xl font-bold">Need something custom?</h3>
          <p className="mt-2 text-muted-foreground">Our team can tailor this product or build something bespoke for your brand.</p>
          <Link
            to="/contact"
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            Talk to SADA <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
