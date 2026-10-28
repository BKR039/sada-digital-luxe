import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ShoppingBag,
  Image as ImageIcon,
  Package,
  Layers,
  Search,
  Globe,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import { MediaUpload, MediaUploadMulti } from "@/components/media/MediaUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SADASelect } from "@/components/ui/sada-select";
import { SADAInput, SADATextarea, SADACounter } from "@/components/ui/sada-ui";
import {
  createDigitalProduct,
  updateDigitalProduct,
  deleteDigitalProduct,
  duplicateDigitalProduct,
  validateGumroadUrl,
} from "@/lib/content-service";
import {
  EditorCommandBar,
  EditorSectionNav,
  EditorSection,
  EditorField,
  SlugField,
  TagListEditor,
  SerpPreview,
  ToggleRow,
  editorInputClass,
  editorTextareaClass,
  useUnsavedChangesWarning,
  useDirtyTracker,
  type EditorSectionDef,
} from "@/components/admin/content/ContentEditorShell";
import { slugify, CURRENCY_OPTIONS, formatPrice } from "@/components/admin/content/content-utils";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductEditor,
});

type SectionKey = "identity" | "offer" | "content" | "presentation" | "seo" | "publishing";

const SECTIONS: EditorSectionDef<SectionKey>[] = [
  { id: "identity", label: "Product Identity", icon: ShoppingBag },
  { id: "offer", label: "The Offer", icon: Package },
  { id: "content", label: "Product Content", icon: Layers },
  { id: "presentation", label: "Presentation", icon: ImageIcon },
  { id: "seo", label: "SEO & Social", icon: Search },
  { id: "publishing", label: "Publishing", icon: Globe },
];

const CATEGORY_OPTIONS = ["Brand Kit", "Templates", "Presets", "Guides", "Toolkits", "Courses"];

function ProductEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const { user, role } = useAuth();
  const nav = useNavigate();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDelete(permCtx);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("identity");

  // Identity
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);

  // Offer
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("");
  const [categoryAr, setCategoryAr] = useState("");
  const [gumroadUrl, setGumroadUrl] = useState("");

  // Product content
  const [includes, setIncludes] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [audience, setAudience] = useState("");
  const [audienceAr, setAudienceAr] = useState("");
  const [details, setDetails] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Presentation
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(10);
  const [ctaLabel, setCtaLabel] = useState("");

  // SEO
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);

  // Publishing
  const [published, setPublished] = useState(false);

  const [showChecklist, setShowChecklist] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const snapshot = JSON.stringify({
    title,
    titleAr,
    slug,
    thumbnailUrl,
    gallery,
    description,
    descriptionAr,
    fullDescription,
    price,
    currency,
    category,
    categoryAr,
    gumroadUrl,
    includes,
    features,
    audience,
    audienceAr,
    details,
    previewUrl,
    featured,
    sortOrder,
    ctaLabel,
    seoTitle,
    seoDescription,
    ogImageUrl,
    published,
  });
  const { dirty, commit } = useDirtyTracker(snapshot, !loading);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("products")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !data) throw error || new Error("Product not found");
        if (!active) return;

        setTitle(data.title || "");
        setTitleAr(data.title_ar || data.name_ar || "");
        setSlug(data.slug || "");
        setSlugTouched(true);
        setThumbnailUrl(data.thumbnail_url || null);
        setGallery(Array.isArray(data.gallery) ? data.gallery : []);
        setDescription(data.description || "");
        setDescriptionAr(data.description_ar || "");
        setFullDescription(data.full_description || "");
        setPrice(data.price === null || data.price === undefined ? "" : String(data.price));
        setCurrency(data.currency || "USD");
        setCategory(data.category || "");
        setCategoryAr(data.category_ar || "");
        setGumroadUrl(data.gumroad_url || "");
        setIncludes(Array.isArray(data.includes) ? data.includes : []);
        setFeatures(Array.isArray(data.features) ? data.features : []);
        setAudience(data.audience || "");
        setAudienceAr(data.target_audience_ar || data.audience_ar || "");
        setDetails(data.details || "");
        setPreviewUrl(data.preview_url || null);
        setFeatured(!!data.featured);
        setSortOrder(data.sort_order ?? 10);
        setCtaLabel(data.cta_label || "");
        setSeoTitle(data.seo_title || "");
        setSeoDescription(data.seo_description || "");
        setOgImageUrl(data.og_image_url || null);
        setPublished(!!data.published);
      } catch (err: any) {
        toast.error(err.message || "Failed to load product");
        nav({ to: "/admin/products" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isNew, nav]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const parsedPrice = price.trim() === "" ? null : Number(price);
  const priceValid = parsedPrice === null || (!Number.isNaN(parsedPrice) && parsedPrice >= 0);
  const gumroadValid = !gumroadUrl.trim() || validateGumroadUrl(gumroadUrl).isValid;

  const checklist = useMemo(() => {
    const checks = [
      { id: "title", label: "Product name is set", passed: title.trim().length > 0 },
      {
        id: "slug",
        label: "Valid URL slug",
        passed: slug.trim().length > 0 && /^[a-z0-9-]+$/.test(slug),
      },
      { id: "desc", label: "Short description written", passed: description.trim().length > 20 },
      { id: "cover", label: "Cover image uploaded", passed: !!thumbnailUrl },
      {
        id: "price",
        label: "Price set (0 is valid for a free product)",
        passed: parsedPrice !== null && priceValid,
      },
      {
        id: "gumroad",
        label: "Gumroad purchase link added",
        passed: gumroadUrl.trim().length > 0 && gumroadValid,
      },
    ];
    return {
      checks,
      allPassed: checks.every((c) => c.passed),
      passed: checks.filter((c) => c.passed).length,
    };
  }, [title, slug, description, thumbnailUrl, parsedPrice, priceValid, gumroadUrl, gumroadValid]);

  const buildPayload = useCallback(
    (nextPublished: boolean, finalSlug: string) => ({
      title: title.trim(),
      title_ar: titleAr.trim() || null,
      name_ar: titleAr.trim() || null,
      slug: finalSlug,
      thumbnail_url: thumbnailUrl,
      gallery,
      description: description.trim() || null,
      description_ar: descriptionAr.trim() || null,
      full_description: fullDescription.trim() || null,
      price: parsedPrice,
      currency: currency || "USD",
      category: category.trim() || null,
      category_ar: categoryAr.trim() || null,
      gumroad_url: gumroadUrl.trim() || null,
      includes,
      features,
      audience: audience.trim() || null,
      target_audience_ar: audienceAr.trim() || null,
      details: details.trim() || null,
      preview_url: previewUrl,
      featured,
      sort_order: sortOrder,
      cta_label: ctaLabel.trim() || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      og_image_url: ogImageUrl,
      published: nextPublished,
    }),
    [
      title,
      titleAr,
      thumbnailUrl,
      gallery,
      description,
      descriptionAr,
      fullDescription,
      parsedPrice,
      currency,
      category,
      categoryAr,
      gumroadUrl,
      includes,
      features,
      audience,
      audienceAr,
      details,
      previewUrl,
      featured,
      sortOrder,
      ctaLabel,
      seoTitle,
      seoDescription,
      ogImageUrl,
    ],
  );

  const handleSave = async (targetPublished?: boolean) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit products.");
      return;
    }
    const nextPublished = targetPublished !== undefined ? targetPublished : published;

    if (!title.trim()) {
      toast.error("Give the product a name before saving.");
      setActiveSection("identity");
      return;
    }
    if (!priceValid) {
      toast.error("Price must be a number of 0 or more.");
      setActiveSection("offer");
      return;
    }
    if (!gumroadValid) {
      toast.error("The Gumroad link must start with http:// or https://");
      setActiveSection("offer");
      return;
    }
    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    if (!finalSlug) {
      toast.error("This product needs a valid URL slug.");
      setActiveSection("identity");
      return;
    }
    if (nextPublished && !checklist.allPassed) {
      setShowChecklist(true);
      return;
    }

    setSaving(true);
    try {
      let slugQuery = (supabase as any).from("products").select("id").eq("slug", finalSlug);
      if (!isNew) slugQuery = slugQuery.neq("id", id);
      const { data: clash } = await slugQuery;
      if (clash && clash.length > 0) {
        toast.error(`The slug "${finalSlug}" is already used by another product.`);
        setActiveSection("identity");
        setSaving(false);
        return;
      }

      const payload = buildPayload(nextPublished, finalSlug);

      if (isNew) {
        const inserted = await createDigitalProduct(payload, {
          actorRole: currentRole,
          actorId: user?.id,
        });
        toast.success(nextPublished ? "Product published" : "Draft saved");
        commit(snapshot);
        nav({ to: "/admin/products/$id", params: { id: inserted.id } });
      } else {
        await updateDigitalProduct(id, payload, {
          actorRole: currentRole,
          actorId: user?.id,
        });
        setPublished(nextPublished);
        setSlug(finalSlug);
        commit(
          JSON.stringify({ ...JSON.parse(snapshot), slug: finalSlug, published: nextPublished }),
        );
        toast.success(nextPublished ? "Product is live in the store" : "Changes saved to draft");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || isNew) return;
    setDeleting(true);
    try {
      await deleteDigitalProduct(id, {
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Product deleted");
      nav({ to: "/admin/products" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleDuplicate = async () => {
    if (isNew) {
      toast.error("Save this product before duplicating it.");
      return;
    }
    setSaving(true);
    try {
      const inserted = await duplicateDigitalProduct(id, {
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Duplicated as a draft");
      nav({ to: "/admin/products/$id", params: { id: inserted.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center text-muted-foreground text-sm">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EditorCommandBar
        backTo="/admin/products"
        backLabel="Back to Digital Products"
        title={title}
        fallbackTitle="New Product"
        subtitle={`/store/${slug || "slug-pending"}`}
        status={published ? "published" : "draft"}
        dirty={dirty}
        saving={saving}
        canEdit={canEdit}
        canDelete={canDelete && !isNew}
        previewUrl={!isNew && slug ? `/store/${slug}` : null}
        onSaveDraft={() => handleSave(false)}
        onPublish={() => handleSave(true)}
        onUnpublish={() => handleSave(false)}
        onDuplicate={!isNew ? handleDuplicate : undefined}
        onDelete={() => setShowDelete(true)}
      />

      <div className="flex-1 max-w-7xl mx-auto w-full grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-4 md:gap-6 p-4 sm:p-6">
        <EditorSectionNav
          sections={SECTIONS}
          active={activeSection}
          onSelect={(key) => {
            setActiveSection(key);
            document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          readiness={{
            passed: checklist.passed,
            total: checklist.checks.length,
            allPassed: checklist.allPassed,
          }}
        />

        <main className="space-y-8 pb-20 min-w-0">
          {/* 01 — IDENTITY */}
          <EditorSection
            id="identity"
            index="01"
            icon={ShoppingBag}
            title="Product identity"
            description="Name, address and the visuals that sell it."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField label="Product name (English)" required>
                <SADAInput
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. SADA Brand Foundation Kit"
                  className="w-full text-base sm:text-lg font-semibold"
                />
              </EditorField>

              <EditorField
                label="Arabic Product Name (اسم المنتج بالعربية)"
                hint="Optional: Shown when the store is viewed in Arabic."
              >
                <SADAInput
                  type="text"
                  dir="rtl"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: حزمة تأسيس الهوية البصرية من صدى"
                  className="w-full text-base sm:text-lg font-semibold text-end"
                />
              </EditorField>
            </div>

            <EditorField
              label="Public slug"
              required
              hint="Old /store/<uuid> links keep working — the product page resolves by slug first, then by id."
            >
              <SlugField
                prefix="/store/"
                value={slug}
                onChange={(v) => {
                  setSlug(slugify(v));
                  setSlugTouched(true);
                }}
                placeholder="brand-foundation-kit"
              />
            </EditorField>

            <EditorField
              label="Cover image"
              hint="Used on the store grid, the product page and the share card."
            >
              <MediaUpload
                value={thumbnailUrl}
                onChange={setThumbnailUrl}
                folder="products"
                label="Upload cover image"
                aspect="aspect-[4/3]"
              />
            </EditorField>

            <EditorField
              label="Gallery"
              hint="Extra screenshots or pages of the product. Shown on the product page."
            >
              <MediaUploadMulti value={gallery} onChange={setGallery} folder="products" />
            </EditorField>
          </EditorSection>

          {/* 02 — OFFER */}
          <EditorSection
            id="offer"
            index="02"
            icon={Package}
            title="The offer"
            description="What it is, what it costs and where it is bought."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField
                label="Short description (English)"
                counter={`${description.length} chars`}
                hint="One or two lines. Shown on the store grid and search snippet."
              >
                <SADATextarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="The value of this product in a sentence."
                />
              </EditorField>

              <EditorField
                label="Short description (الوصف المختصر بالعربية)"
                counter={`${descriptionAr.length} chars`}
                hint="يظهر في بطاقة المنتج وفي محركات البحث بالعربية."
              >
                <SADATextarea
                  dir="rtl"
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  rows={3}
                  placeholder="القيمة الجوهرية لهذا المنتج في جملة واحدة..."
                  className="text-end"
                />
              </EditorField>
            </div>

            <EditorField label="Full description" hint="The long-form pitch on the product page.">
              <SADATextarea
                value={fullDescription}
                onChange={(e) => setFullDescription(e.target.value)}
                rows={6}
                placeholder="Explain what the buyer gets and why it works."
              />
            </EditorField>

            <div className="grid sm:grid-cols-4 gap-4">
              <EditorField label="Price" required hint="Use 0 for free.">
                <SADAInput
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="29"
                  aria-invalid={!priceValid}
                  prefix={currency}
                />
              </EditorField>

              <EditorField label="Currency">
                <SADASelect
                  value={currency}
                  onChange={setCurrency}
                  size="lg"
                  aria-label="Currency"
                  options={CURRENCY_OPTIONS}
                />
              </EditorField>

              <EditorField label="Category (English)">
                <SADASelect
                  value={category}
                  onChange={setCategory}
                  size="lg"
                  placeholder="Select..."
                  aria-label="Product category"
                  options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                />
              </EditorField>

              <EditorField label="Category (التصنيف بالعربية)">
                <SADAInput
                  type="text"
                  dir="rtl"
                  value={categoryAr}
                  onChange={(e) => setCategoryAr(e.target.value)}
                  placeholder="مثال: حزمة هوية"
                  className="text-end"
                />
              </EditorField>
            </div>

            <EditorField
              label="Gumroad purchase link"
              required
              hint="Gumroad stays the checkout. SADA never takes payment on-site."
            >
              <div className="flex items-center gap-2">
                <SADAInput
                  type="url"
                  value={gumroadUrl}
                  onChange={(e) => setGumroadUrl(e.target.value)}
                  placeholder="https://gumroad.com/l/..."
                  aria-invalid={!gumroadValid}
                />
                {gumroadUrl.trim() && gumroadValid && (
                  <a
                    href={gumroadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Open Gumroad link"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </EditorField>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                  Live Offer Preview
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">
                    {formatPrice(parsedPrice, currency)}
                  </span>
                  {category && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {category}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs">
                {gumroadUrl.trim() && gumroadValid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    <Check className="size-3.5" /> Gumroad Checkout Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                    <AlertTriangle className="size-3.5" /> Checkout Link Required
                  </span>
                )}
              </div>
            </div>
          </EditorSection>

          {/* 03 — PRODUCT CONTENT */}
          <EditorSection
            id="content"
            index="03"
            icon={Layers}
            title="Product content"
            description="The specifics a buyer checks before paying. Every line here is your own claim — nothing is pre-filled."
          >
            <EditorField
              label="What's included"
              hint="One entry per deliverable. Press Enter to add."
            >
              <TagListEditor
                items={includes}
                onChange={setIncludes}
                placeholder="e.g. 32-page brand guidelines template"
              />
            </EditorField>

            <EditorField label="Features" hint="Shown as a checklist on the product page.">
              <TagListEditor
                items={features}
                onChange={setFeatures}
                placeholder="e.g. Editable in Figma"
              />
            </EditorField>

            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField label="Who it's for (English)">
                <SADATextarea
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  rows={3}
                  placeholder="e.g. Founders launching a first brand without an in-house designer."
                />
              </EditorField>

              <EditorField label="Who it's for (الفئة المستهدفة بالعربية)">
                <SADATextarea
                  dir="rtl"
                  value={audienceAr}
                  onChange={(e) => setAudienceAr(e.target.value)}
                  rows={3}
                  placeholder="مثال: المؤسسون وأصحاب المشاريع الذين يبنون علاماتهم الأولى..."
                  className="text-end"
                />
              </EditorField>
            </div>

            <EditorField
              label="Product details"
              hint="Formats, file sizes, requirements, licence terms."
            >
              <SADATextarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder="e.g. Figma + PDF. Requires a free Figma account."
              />
            </EditorField>

            <EditorField
              label="Preview media"
              hint="An optional sample image or video of the product."
            >
              <MediaUpload
                value={previewUrl}
                onChange={setPreviewUrl}
                folder="products"
                label="Upload preview"
                aspect="aspect-video"
              />
            </EditorField>
          </EditorSection>

          {/* 04 — PRESENTATION */}
          <EditorSection
            id="presentation"
            index="04"
            icon={ImageIcon}
            title="Presentation"
            description="How this product is positioned inside the store."
          >
            <ToggleRow
              checked={featured}
              onChange={setFeatured}
              label="Feature this product"
              description="Featured products lead the store listing."
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField label="Sort order" hint="Lower numbers appear first.">
                <SADACounter
                  value={sortOrder}
                  onChange={setSortOrder}
                  min={0}
                />
              </EditorField>

              <EditorField label="Purchase button label" hint="Leave blank for the default.">
                <SADAInput
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Get the kit"
                />
              </EditorField>
            </div>
          </EditorSection>

          {/* 05 — SEO */}
          <EditorSection
            id="seo"
            index="05"
            icon={Search}
            title="SEO & social"
            description="Overrides for search engines and share cards."
          >
            <EditorField
              label="SEO title"
              counter={`${(seoTitle || title).length}/60`}
              hint="Falls back to the product name."
            >
              <SADAInput
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={title || "Custom search title"}
              />
            </EditorField>

            <EditorField
              label="Meta description"
              counter={`${(seoDescription || description).length}/160`}
              hint="Falls back to the short description."
            >
              <SADATextarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder={description || "A short summary for search results."}
              />
            </EditorField>

            <EditorField label="Social share image" hint="Falls back to the cover image.">
              <MediaUpload
                value={ogImageUrl}
                onChange={setOgImageUrl}
                folder="products"
                label="Upload share image"
                aspect="aspect-video"
              />
            </EditorField>

            <SerpPreview
              url={`sada.tn/store/${slug || "slug-pending"}`}
              title={seoTitle || title}
              description={seoDescription || description}
            />
          </EditorSection>

          {/* 06 — PUBLISHING */}
          <EditorSection
            id="publishing"
            index="06"
            icon={Globe}
            title="Publishing"
            description="Only published products appear in the public store."
          >
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Current state
              </div>
              <p className="text-sm">
                {published
                  ? "Published — visible at /store and on its own product page."
                  : "Draft — invisible to the public, including by direct link."}
              </p>
            </div>

            <ToggleRow
              checked={published}
              onChange={(v) => handleSave(v)}
              disabled={saving || !canEdit}
              label="Published"
              description="Saves immediately. Publishing runs the readiness checklist first."
            />
          </EditorSection>
        </main>
      </div>

      <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Not ready to publish
            </DialogTitle>
            <DialogDescription>Finish these before this product goes on sale.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {checklist.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2.5 text-sm">
                {check.passed ? (
                  <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <X className="size-4 text-destructive mt-0.5 shrink-0" />
                )}
                <span
                  className={
                    check.passed ? "text-muted-foreground line-through" : "text-foreground"
                  }
                >
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowChecklist(false)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
            >
              Keep editing
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently delete this product?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{title}" and its product page will be removed for good. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
