import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Check, ShoppingBag, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { MediaGallery } from "@/components/media/MediaGallery";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

interface Product {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  full_description: string | null;
  price: number | null;
  currency: string | null;
  thumbnail_url: string | null;
  gallery: string[] | null;
  preview_url: string | null;
  gumroad_url: string | null;
  category: string | null;
  includes: string[] | null;
  features: string[] | null;
  audience: string | null;
  details: string | null;
  cta_label: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  title_ar?: string | null;
  description_ar?: string | null;
  full_description_ar?: string | null;
  category_ar?: string | null;
  audience_ar?: string | null;
  details_ar?: string | null;
  cta_label_ar?: string | null;
  seo_title_ar?: string | null;
  seo_description_ar?: string | null;
}

/**
 * Resolves by slug first, then by uuid, so links created before products had
 * slugs keep working. Only published products are returned to public visitors —
 * RLS enforces that for anonymous visitors regardless of this filter.
 */
async function fetchProduct(idOrSlug: string, isPreview = false): Promise<Product | null> {
  let querySlug = (supabase as any).from("products").select("*").eq("slug", idOrSlug);
  if (!isPreview) querySlug = querySlug.eq("published", true);
  const bySlug = await querySlug.maybeSingle();
  if (bySlug.data) return bySlug.data as Product;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  if (!isUuid) return null;

  let queryId = (supabase as any).from("products").select("*").eq("id", idOrSlug);
  if (!isPreview) queryId = queryId.eq("published", true);
  const byId = await queryId.maybeSingle();
  return (byId.data as Product) || null;
}

async function fetchRelated(excludeId: string, category: string | null): Promise<Product[]> {
  let query = (supabase as any)
    .from("products")
    .select("id,slug,title,price,currency,thumbnail_url,category,title_ar,category_ar")
    .eq("published", true)
    .neq("id", excludeId);
  if (category) query = query.eq("category", category);
  const { data } = await query.order("sort_order").limit(3);
  const found = (data as Product[]) || [];
  if (found.length > 0 || !category) return found;

  const { data: any3 } = await (supabase as any)
    .from("products")
    .select("id,slug,title,price,currency,thumbnail_url,category,title_ar,category_ar")
    .eq("published", true)
    .neq("id", excludeId)
    .order("sort_order")
    .limit(3);
  return (any3 as Product[]) || [];
}

function priceLabel(price: number | null, currency: string | null, isAr = false): string {
  if (price === null || price === undefined) return "—";
  if (price === 0) return isAr ? "مجاني" : "Free";
  return `${currency || "USD"} ${Number(price).toFixed(0)}`;
}

interface StoreProductSearchParams {
  preview?: boolean;
}

export const Route = createFileRoute("/store/$id")({
  validateSearch: (search: Record<string, unknown>): StoreProductSearchParams => ({
    preview: search.preview === "true" || search.preview === true ? true : undefined,
  }),
  loader: async ({ params }) => {
    const isPreview =
      typeof window !== "undefined" && window.location.search.includes("preview=true");
    const product = await fetchProduct(params.id, isPreview);
    const related = product ? await fetchRelated(product.id, product.category) : [];
    return { product, related };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return { meta: [{ title: "Product not found — SADA" }] };

    const title = p.seo_title || `${p.title} — SADA`;
    const description =
      p.seo_description || p.description || `${p.title}, a digital product by SADA.`;
    const image = p.og_image_url || p.thumbnail_url;
    const path = `/store/${p.slug || p.id}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { property: "og:url", content: path },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ],
      links: [{ rel: "canonical", href: path }],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, related } = Route.useLoaderData();
  const search = Route.useSearch();
  const isPreview =
    search.preview === true ||
    (typeof window !== "undefined" && window.location.search.includes("preview=true"));
  const { language } = useI18n();
  const isAr = language === "ar";

  if (!product) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold font-display">
            {isAr ? "المنتج غير موجود" : "Product not found"}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isAr ? "قد يكون هذا المنتج غير منشور أو تمت إزالته." : "This product may have been unpublished or removed."}
          </p>
          <Link to="/store" className="mt-4 inline-flex items-center gap-2 text-primary font-medium">
            <ArrowLeft className="size-4 rtl-flip" />
            <span>{isAr ? "الرجوع إلى المتجر" : "Back to products"}</span>
          </Link>
        </div>
      </div>
    );
  }

  const title = getLocalizedContent(product, "title", language);
  const description = getLocalizedContent(product, "description", language);
  const fullDescription = getLocalizedContent(product, "full_description", language);
  const category = getLocalizedContent(product, "category", language);
  const audience = getLocalizedContent(product, "audience", language);
  const details = getLocalizedContent(product, "details", language);
  const ctaLabel = getLocalizedContent(product, "cta_label", language);

  const label = priceLabel(product.price, product.currency, isAr);
  const buyLabel = ctaLabel || (isAr ? "احصل عليه الآن" : "Get it now");
  const includes = (product.includes || []).filter(Boolean);
  const features = (product.features || []).filter(Boolean);
  const gallery = (product.gallery || []).filter(Boolean);
  const isSafeGumroadUrl =
    Boolean(product.gumroad_url) && /^https?:\/\//i.test(product.gumroad_url!.trim());
  const hasPurchaseLink = isSafeGumroadUrl;

  /** Purchase always hands off to Gumroad — SADA never takes payment on-site. */
  const BuyButton = ({ className }: { className: string }) =>
    isSafeGumroadUrl ? (
      <a
        href={product.gumroad_url!}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span>{buyLabel}</span>
        <ArrowUpRight className="size-4 rtl-flip" />
      </a>
    ) : (
      <Link to="/contact" className={className}>
        <span>{isAr ? "استفسر عن هذا المنتج" : "Ask about this product"}</span>
        <ArrowUpRight className="size-4 rtl-flip" />
      </Link>
    );

  return (
    <article className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 font-medium"
        >
          <ArrowLeft className="size-4 rtl-flip" />
          <span>{isAr ? "الرجوع إلى المتجر" : "Back to products"}</span>
        </Link>

        {isPreview && !product.published && (
          <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm font-semibold flex items-center justify-between">
            <span>
              {isAr
                ? "وضع المعاينة للمحرر — هذا المنتج مسودة وغير معروض للجمهور."
                : "Editor Preview Mode — This product is currently an unpublished draft."}
            </span>
            <span className="uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-xs">
              {isAr ? "مسودة" : "Draft"}
            </span>
          </div>
        )}

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
            {category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] uppercase text-primary">
                <Sparkles className="size-3.5" /> {category}
              </span>
            )}
            <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-[1.1] font-display">{title}</h1>
            {description && (
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}

            <div className="mt-8 p-6 rounded-2xl border border-border bg-card soft-shadow">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {isAr ? "سعر الشراء لمرة واحدة" : "One-time price"}
                  </div>
                  <div className="text-3xl font-display font-bold" dir="ltr">{label}</div>
                </div>
                <BuyButton className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.03] transition-transform" />
              </div>

              {includes.length > 0 && (
                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {includes.slice(0, 4).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" /> <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-20 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            {fullDescription && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "نظرة عامة على المنتج" : "Product overview"}
                </h2>
                {fullDescription
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line, i) => (
                    <p key={i} className="mt-4 text-foreground/85 leading-relaxed">
                      {line.trim()}
                    </p>
                  ))}
              </section>
            )}

            {includes.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "ما تتضمنه الحزمة" : "What's included"}
                </h2>
                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {includes.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card"
                    >
                      <div className="size-8 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                        <Check className="size-4" />
                      </div>
                      <span className="text-sm font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "الميزات والخصائص" : "Features"}
                </h2>
                <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {audience && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "لمن هذا المنتج؟" : "Who it's for"}
                </h2>
                <div className="mt-5 flex items-start gap-3 p-5 rounded-2xl border border-border bg-card">
                  <div className="size-9 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Users className="size-4" />
                  </div>
                  <p className="text-foreground/85 leading-relaxed">{audience}</p>
                </div>
              </section>
            )}

            {gallery.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "نظرة من الداخل" : "A look inside"}
                </h2>
                <div className="mt-6">
                  <MediaGallery items={gallery} />
                </div>
              </section>
            )}

            {product.preview_url && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "معاينة المنتج" : "Preview"}
                </h2>
                <div className="mt-6 rounded-3xl overflow-hidden border border-border bg-card">
                  <SmartMedia src={product.preview_url} className="w-full" autoplay={false} />
                </div>
              </section>
            )}

            {details && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold font-display">
                  {isAr ? "تفاصيل إضافية" : "Product details"}
                </h2>
                <div className="mt-5 rounded-2xl border border-border bg-card p-5">
                  {details
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, i) => (
                      <p
                        key={i}
                        className="text-sm text-foreground/85 leading-relaxed [&+p]:mt-2.5"
                      >
                        {line.trim()}
                      </p>
                    ))}
                </div>
              </section>
            )}
          </div>

          {/* Sticky buy column */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-border bg-card p-6 elevated-shadow">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {isAr ? "طلب المنتج" : "Get the product"}
              </div>
              <div className="mt-1 text-2xl font-display font-bold" dir="ltr">{label}</div>

              <BuyButton className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform" />

              <Link
                to="/contact"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-semibold"
              >
                {isAr ? "تحدث مع فريقنا" : "Talk to the team"}
              </Link>

              {hasPurchaseLink && (
                <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed text-center">
                  {isAr ? "تتم عمليات الدفع والتسليم بأمان عبر منصة Gumroad." : "Checkout and delivery are handled by Gumroad."}
                </p>
              )}

              {includes.length > 0 && (
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {includes.slice(0, 4).map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" /> <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20">
            <h3 className="text-2xl md:text-3xl font-bold font-display">
              {isAr ? "منتجات ذات صلة" : "Related products"}
            </h3>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((r) => {
                const rTitle = getLocalizedContent(r, "title", language);
                const rCat = getLocalizedContent(r, "category", language);
                return (
                  <Link
                    key={r.id}
                    to="/store/$id"
                    params={{ id: r.slug || r.id }}
                    className="group block rounded-2xl overflow-hidden border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
                  >
                    <div className="aspect-[4/3] bg-muted overflow-hidden">
                      {r.thumbnail_url ? (
                        <SmartMedia
                          src={r.thumbnail_url}
                          className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                          autoplay={false}
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <ShoppingBag className="size-10 text-primary/60" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      {rCat && (
                        <div className="text-[10px] uppercase tracking-widest text-primary mb-1 font-bold">
                          {rCat}
                        </div>
                      )}
                      <div className="font-bold font-display group-hover:text-primary transition-colors">
                        {rTitle}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground" dir="ltr">
                        {priceLabel(r.price, r.currency, isAr)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Final CTA */}
        <div className="mt-20 rounded-3xl glass-strong p-10 text-center">
          <h3 className="text-2xl md:text-3xl font-bold font-display">
            {isAr ? "هل تحتاج إلى حلول مصممة خصيصاً؟" : "Need something custom?"}
          </h3>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {isAr
              ? "يمكن لفريقنا تخصيص هذا المنتج أو بناء تجربة مخصصة بالكامل لعلامتك التجارية."
              : "Our team can tailor this product or build something bespoke for your brand."}
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            <span>{isAr ? "تحدث مع صدى" : "Talk to SADA"}</span>
            <ArrowUpRight className="size-4 rtl-flip" />
          </Link>
        </div>
      </div>
    </article>
  );
}
