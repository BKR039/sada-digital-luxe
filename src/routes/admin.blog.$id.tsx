import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  PenLine,
  Search,
  CalendarClock,
  AlertTriangle,
  Check,
  X,
  Eye,
  Info,
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "@/lib/content-service";
import { MediaUpload } from "@/components/media/MediaUpload";
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
import { SADAInput, SADATextarea } from "@/components/ui/sada-ui";
import { SADADateDateTimePicker } from "@/components/ui/sada-date-time-picker";
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
import {
  slugify,
  deriveStatus,
  estimateReadingMinutes,
  formatDateTime,
} from "@/components/admin/content/content-utils";
import { ArticleContent, ARTICLE_SYNTAX_HELP } from "@/components/site/ArticleContent";

export const Route = createFileRoute("/admin/blog/$id")({
  component: BlogEditor,
});

type SectionKey = "basics" | "cover" | "content" | "seo" | "publishing";

const SECTIONS: EditorSectionDef<SectionKey>[] = [
  { id: "basics", label: "Basics", icon: FileText },
  { id: "cover", label: "Cover", icon: ImageIcon },
  { id: "content", label: "Content", icon: PenLine },
  { id: "seo", label: "SEO & Social", icon: Search },
  { id: "publishing", label: "Publishing", icon: CalendarClock },
];

/** Editorial categories the public /blog page filters on. */
const CATEGORY_OPTIONS = [
  "Branding",
  "Digital Marketing",
  "Content Creation",
  "AI & Automation",
  "Business Growth",
  "Social Media",
  "Web Design",
];

function BlogEditor() {
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
  const [activeSection, setActiveSection] = useState<SectionKey>("basics");

  // Basics
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [excerptAr, setExcerptAr] = useState("");
  const [category, setCategory] = useState("");
  const [categoryAr, setCategoryAr] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);

  // Cover
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");

  // Content
  const [content, setContent] = useState("");
  const [contentAr, setContentAr] = useState("");
  const [contentLang, setContentLang] = useState<"en" | "ar">("en");
  const [showPreview, setShowPreview] = useState(false);

  // SEO
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);

  // Publishing
  const [published, setPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");

  const [showChecklist, setShowChecklist] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const snapshot = JSON.stringify({
    title,
    titleAr,
    slug,
    excerpt,
    excerptAr,
    category,
    categoryAr,
    author,
    tags,
    featured,
    coverUrl,
    coverAlt,
    content,
    contentAr,
    seoTitle,
    seoDescription,
    ogImageUrl,
    published,
    publishedAt,
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
          .from("blog_posts")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !data) throw error || new Error("Article not found");
        if (!active) return;

        setTitle(data.title || "");
        setTitleAr(data.title_ar || "");
        setSlug(data.slug || "");
        setSlugTouched(true);
        setExcerpt(data.excerpt || "");
        setExcerptAr(data.excerpt_ar || "");
        setCategory(data.category || "");
        setCategoryAr(data.category_ar || "");
        setAuthor(data.author || "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setFeatured(!!data.featured);
        setCoverUrl(data.cover_url || null);
        setCoverAlt(data.cover_alt || "");
        setContent(data.content || "");
        setContentAr(data.content_ar || "");
        setSeoTitle(data.seo_title || "");
        setSeoDescription(data.seo_description || "");
        setOgImageUrl(data.og_image_url || null);
        setPublished(!!data.published);
        setPublishedAt(data.published_at || "");
      } catch (err: any) {
        toast.error(err.message || "Failed to load article");
        nav({ to: "/admin/blog" });
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

  const status = deriveStatus({ published, published_at: publishedAt || null });
  const readingMinutes = useMemo(() => estimateReadingMinutes(content), [content]);

  const checklist = useMemo(() => {
    const checks = [
      { id: "title", label: "Article title is set", passed: title.trim().length > 0 },
      {
        id: "slug",
        label: "Valid URL slug",
        passed: slug.trim().length > 0 && /^[a-z0-9-]+$/.test(slug),
      },
      {
        id: "excerpt",
        label: "Excerpt written (used on cards and in search results)",
        passed: excerpt.trim().length > 20,
      },
      { id: "content", label: "Article body has content", passed: content.trim().length > 120 },
      { id: "cover", label: "Cover image uploaded", passed: !!coverUrl },
      { id: "category", label: "Category selected", passed: category.trim().length > 0 },
    ];
    return {
      checks,
      allPassed: checks.every((c) => c.passed),
      passed: checks.filter((c) => c.passed).length,
    };
  }, [title, slug, excerpt, content, coverUrl, category]);

  const buildPayload = useCallback(
    (nextPublished: boolean, finalSlug: string) => {
      // Publishing without an explicit date means "now", never an empty schedule.
      // Back-buffered by 5s to ensure immediate visibility despite any client-to-server clock skew at RLS level.
      let nextPublishedAt: string | null = publishedAt || null;
      if (nextPublished && !nextPublishedAt) nextPublishedAt = new Date(Date.now() - 5000).toISOString();

      return {
        title: title.trim(),
        title_ar: titleAr.trim() || null,
        slug: finalSlug,
        excerpt: excerpt.trim() || null,
        excerpt_ar: excerptAr.trim() || null,
        category: category.trim() || null,
        category_ar: categoryAr.trim() || null,
        author: author.trim() || null,
        tags,
        featured,
        cover_url: coverUrl,
        cover_alt: coverAlt.trim() || null,
        content: content.trim() || null,
        content_ar: contentAr.trim() || null,
        reading_minutes: readingMinutes || null,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        og_image_url: ogImageUrl,
        published: nextPublished,
        published_at: nextPublishedAt,
      };
    },
    [
      title,
      titleAr,
      excerpt,
      excerptAr,
      category,
      categoryAr,
      author,
      tags,
      featured,
      coverUrl,
      coverAlt,
      content,
      contentAr,
      readingMinutes,
      seoTitle,
      seoDescription,
      ogImageUrl,
      publishedAt,
    ],
  );

  const handleSave = async (targetPublished?: boolean) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit articles.");
      return;
    }
    const nextPublished = targetPublished !== undefined ? targetPublished : published;

    if (!title.trim()) {
      toast.error("Give the article a title before saving.");
      setActiveSection("basics");
      return;
    }
    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    if (!finalSlug) {
      toast.error("This article needs a valid URL slug.");
      setActiveSection("basics");
      return;
    }
    if (nextPublished && !checklist.allPassed) {
      setShowChecklist(true);
      return;
    }

    setSaving(true);
    try {
      let slugQuery = (supabase as any).from("blog_posts").select("id").eq("slug", finalSlug);
      if (!isNew) slugQuery = slugQuery.neq("id", id);
      const { data: clash } = await slugQuery;
      if (clash && clash.length > 0) {
        toast.error(`The slug "${finalSlug}" is already used by another article.`);
        setActiveSection("basics");
        setSaving(false);
        return;
      }

      const payload = buildPayload(nextPublished, finalSlug);

      if (isNew) {
        const inserted = await createBlogPost(payload, {
          ctx: permCtx,
          actorRole: currentRole,
          actorId: user?.id,
        });
        toast.success(nextPublished ? "Article published" : "Draft saved");
        commit(snapshot);
        nav({ to: "/admin/blog/$id", params: { id: inserted.id } });
      } else {
        await updateBlogPost(id, payload, {
          ctx: permCtx,
          actorRole: currentRole,
          actorId: user?.id,
        });
        setPublished(nextPublished);
        if (payload.published_at) setPublishedAt(payload.published_at);
        commit(
          JSON.stringify({
            title,
            titleAr,
            slug: finalSlug,
            excerpt,
            excerptAr,
            category,
            categoryAr,
            author,
            tags,
            featured,
            coverUrl,
            coverAlt,
            content,
            contentAr,
            seoTitle,
            seoDescription,
            ogImageUrl,
            published: nextPublished,
            publishedAt: payload.published_at || "",
          }),
        );
        const scheduled =
          nextPublished && payload.published_at && new Date(payload.published_at) > new Date();
        toast.success(
          !nextPublished
            ? "Changes saved to draft"
            : scheduled
              ? "Article scheduled"
              : "Article published",
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || isNew) return;
    setDeleting(true);
    try {
      await deleteBlogPost(id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Article deleted");
      nav({ to: "/admin/blog" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete article");
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center text-muted-foreground text-sm">Loading editor...</div>
      </div>
    );
  }

  const previewSlug = slug || slugify(title);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EditorCommandBar
        backTo="/admin/blog"
        backLabel="Back to Blog"
        title={title}
        fallbackTitle="New Article"
        subtitle={`/blog/${slug || "slug-pending"}`}
        status={status}
        dirty={dirty}
        saving={saving}
        canEdit={canEdit}
        canDelete={canDelete && !isNew}
        previewUrl={previewSlug ? `/blog/${previewSlug}?preview=true` : null}
        onSaveDraft={() => handleSave(false)}
        onPublish={() => handleSave(true)}
        onUnpublish={() => handleSave(false)}
        onDelete={() => setShowDelete(true)}
        publishLabel={publishedAt && new Date(publishedAt) > new Date() ? "Schedule" : "Publish"}
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
          {/* 01 — BASICS */}
          <EditorSection
            id="basics"
            index="01"
            icon={FileText}
            title="Article basics"
            description="Headline, address, summary and where this sits editorially."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField label="Title (English)" required>
                <SADAInput
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Why most brand refreshes fail in the first month"
                  className="w-full text-base sm:text-lg font-semibold"
                />
              </EditorField>

              <EditorField
                label="Arabic Title (العنوان بالعربية)"
                hint="Optional: Shown when the site is viewed in Arabic. Falls back to English if empty."
              >
                <SADAInput
                  type="text"
                  dir="rtl"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: لماذا تفشل أغلب عمليات تجديد العلامات التجارية"
                  className="w-full text-base sm:text-lg font-semibold text-end"
                />
              </EditorField>
            </div>

            <EditorField
              label="Public slug"
              required
              hint="Auto-generated from the title, editable until you are happy with it."
            >
              <SlugField
                prefix="/blog/"
                value={slug}
                onChange={(v) => {
                  setSlug(slugify(v));
                  setSlugTouched(true);
                }}
                placeholder="why-brand-refreshes-fail"
              />
            </EditorField>

            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField
                label="Excerpt (English)"
                counter={`${excerpt.length} chars`}
                hint="Shown on article cards and search snippet."
              >
                <SADATextarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  placeholder="One or two sentences that make someone want to read this."
                />
              </EditorField>

              <EditorField
                label="Arabic Excerpt (الموجز بالعربية)"
                counter={`${excerptAr.length} chars`}
                hint="Shown on article cards when viewed in Arabic."
              >
                <SADATextarea
                  dir="rtl"
                  value={excerptAr}
                  onChange={(e) => setExcerptAr(e.target.value)}
                  rows={3}
                  placeholder="جملة أو جملتان تلخصان المقال باللغة العربية..."
                  className="text-end"
                />
              </EditorField>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <EditorField label="Category">
                <SADASelect
                  value={category}
                  onChange={setCategory}
                  size="lg"
                  placeholder="Select a category..."
                  aria-label="Article category"
                  options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                />
              </EditorField>

              <EditorField
                label="Arabic Category (التصنيف بالعربية)"
                hint="Arabic display name for filter pill."
              >
                <SADAInput
                  type="text"
                  dir="rtl"
                  value={categoryAr}
                  onChange={(e) => setCategoryAr(e.target.value)}
                  placeholder="مثال: الهوية البصرية"
                  className="text-end"
                />
              </EditorField>

              <EditorField label="Author" hint="The person this is published under.">
                <SADAInput
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. SADA Team"
                />
              </EditorField>
            </div>

            <EditorField label="Tags" hint="Used for on-site search. Press Enter to add.">
              <TagListEditor items={tags} onChange={setTags} placeholder="e.g. branding" />
            </EditorField>

            <ToggleRow
              checked={featured}
              onChange={setFeatured}
              label="Feature this article"
              description="Featured articles lead the public blog grid."
            />
          </EditorSection>

          {/* 02 — COVER */}
          <EditorSection
            id="cover"
            index="02"
            icon={ImageIcon}
            title="Cover image"
            description="Leads the article page, the blog grid and the social share card."
          >
            <EditorField label="Cover image">
              <MediaUpload
                value={coverUrl}
                onChange={setCoverUrl}
                folder="blog"
                label="Upload cover image"
                aspect="aspect-video"
              />
            </EditorField>

            <EditorField
              label="Alt text"
              hint="Describe the image for screen readers and for when it fails to load."
            >
              <SADAInput
                type="text"
                value={coverAlt}
                onChange={(e) => setCoverAlt(e.target.value)}
                placeholder="e.g. Designer reviewing a brand identity board"
              />
            </EditorField>
          </EditorSection>

          {/* 03 — CONTENT */}
          <EditorSection
            id="content"
            index="03"
            icon={PenLine}
            title="Article content"
            description="Plain text with light formatting — rendered by the same component as the public page."
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex p-1 rounded-xl bg-muted/70 border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setContentLang("en")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    contentLang === "en"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  English Body
                </button>
                <button
                  type="button"
                  onClick={() => setContentLang("ar")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    contentLang === "ar"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Arabic Body (المحتوى بالعربية)
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  {contentLang === "en"
                    ? content.trim()
                      ? `${content.trim().split(/\s+/).length} words · ~${readingMinutes} min read`
                      : "Empty"
                    : contentAr.trim()
                      ? `${contentAr.trim().split(/\s+/).length} words`
                      : "Empty (Falls back to English)"}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={contentLang === "en" ? !content.trim() : !contentAr.trim()}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Eye className="size-3.5" /> Preview rendering
                </button>
              </div>
            </div>

            {contentLang === "en" ? (
              <SADATextarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                placeholder={
                  "## Start with the idea\n\nWrite a paragraph here.\n\n- A point worth making\n- Another point\n\n> A line worth quoting."
                }
                className="font-mono text-[13px] leading-[1.7]"
              />
            ) : (
              <SADATextarea
                dir="rtl"
                value={contentAr}
                onChange={(e) => setContentAr(e.target.value)}
                rows={20}
                placeholder={
                  "## ابدأ بالفكرة\n\nاكتب فقرة هنا باللغة العربية.\n\n- نقطة أولى\n- نقطة ثانية\n\n> اقتباس يستحق الإبراز."
                }
                className="font-mono text-[13px] leading-[1.7] text-end"
              />
            )}

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                <Info className="size-3.5" /> Formatting
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {ARTICLE_SYNTAX_HELP.map((item) => (
                  <div
                    key={item.syntax}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <code className="font-mono text-[11px] text-primary truncate">
                      {item.syntax}
                    </code>
                    <span className="text-muted-foreground shrink-0">{item.result}</span>
                  </div>
                ))}
              </div>
            </div>
          </EditorSection>

          {/* 04 — SEO */}
          <EditorSection
            id="seo"
            index="04"
            icon={Search}
            title="SEO & social"
            description="Overrides for search engines and share cards. Leave blank to use the article's own copy."
          >
            <EditorField
              label="SEO title"
              counter={`${(seoTitle || title).length}/60`}
              hint="Falls back to the article title."
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
              counter={`${(seoDescription || excerpt).length}/160`}
              hint="Falls back to the excerpt."
            >
              <SADATextarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder={excerpt || "A short summary for search results."}
              />
            </EditorField>

            <EditorField label="Social share image" hint="Falls back to the cover image.">
              <MediaUpload
                value={ogImageUrl}
                onChange={setOgImageUrl}
                folder="blog"
                label="Upload share image"
                aspect="aspect-video"
              />
            </EditorField>

            <SerpPreview
              url={`sada.tn/blog/${slug || "slug-pending"}`}
              title={seoTitle || title}
              description={seoDescription || excerpt}
            />
          </EditorSection>

          {/* 05 — PUBLISHING */}
          <EditorSection
            id="publishing"
            index="05"
            icon={CalendarClock}
            title="Publishing"
            description="Go live now, or set a date and time for this article to appear."
          >
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Current state
              </div>
              <p className="text-sm">
                {status === "draft" && "Draft — not visible to anyone outside the admin."}
                {status === "scheduled" && `Scheduled — goes live ${formatDateTime(publishedAt)}.`}
                {status === "published" && `Published ${formatDateTime(publishedAt)}.`}
              </p>
            </div>

            <EditorField
              label="Publish date & time"
              hint="A future date schedules the article. The database keeps scheduled articles private until that moment — they are not merely hidden in the interface."
            >
              <SADADateDateTimePicker
                value={publishedAt || null}
                onChange={(v) => setPublishedAt(v)}
                size="lg"
                placeholder="Publish immediately when published"
                aria-label="Publish date and time"
              />
            </EditorField>

            {publishedAt && (
              <button
                type="button"
                onClick={() => setPublishedAt("")}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <X className="size-3.5" /> Clear schedule (publish immediately)
              </button>
            )}
          </EditorSection>
        </main>
      </div>

      {/* Publish checklist */}
      <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Not ready to publish
            </DialogTitle>
            <DialogDescription>
              Finish these before this article goes on the public site.
            </DialogDescription>
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

      {/* Content preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {contentLang === "ar" && titleAr.trim() ? titleAr : title || "Untitled article"}
            </DialogTitle>
            <DialogDescription>
              {contentLang === "ar"
                ? "معاينة المظهر بنفس مكوّن صفحة المقال العامة."
                : "Rendered with the same component as the public article page."}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2" dir={contentLang === "ar" ? "rtl" : "ltr"}>
            <ArticleContent
              content={
                contentLang === "ar" && contentAr.trim()
                  ? contentAr
                  : content
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently delete this article?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{title}" and its public URL will be removed for good. This cannot be undone.
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
