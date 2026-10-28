import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus,
  Edit3,
  Eye,
  Trash2,
  Star,
  AlertTriangle,
  PenLine,
  Clock,
  User,
  CalendarClock,
  Globe,
  EyeOff,
} from "lucide-react";
import { permissions, normalizeRole, type PermissionContext } from "@/lib/permissions";
import {
  publishBlogPost,
  setFeaturedBlogPost,
  deleteBlogPost,
  toggleBlogVisibility,
} from "@/lib/content-service";
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
import { SmartMedia } from "@/components/media/SmartMedia";
import {
  ContentHeader,
  ContentKpiGrid,
  ContentToolbar,
  ContentEmptyState,
  ContentStatusBadge,
  ContentFeaturedBadge,
  ContentListSkeleton,
  ContentErrorState,
} from "@/components/admin/content/ContentShell";
import {
  deriveStatus,
  formatDate,
  formatRelative,
  truncate,
  SORT_OPTIONS,
  type ContentStatus,
  type SortKey,
} from "@/components/admin/content/content-utils";

export const Route = createFileRoute("/admin/blog/")({
  component: BlogCMS,
});

interface BlogRow {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  excerpt: string | null;
  excerpt_ar?: string | null;
  cover_url: string | null;
  category: string | null;
  category_ar?: string | null;
  author: string | null;
  tags: string[];
  reading_minutes: number | null;
  published: boolean;
  published_at: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

/** Blog visibility is a site-wide feature flag, not a per-article setting. */
function BlogVisibilityCard({
  canEdit,
  permCtx,
  currentRole,
  userId,
}: {
  canEdit: boolean;
  permCtx: PermissionContext;
  currentRole: string;
  userId?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("site_settings")
      .select("enabled")
      .eq("key", "blog")
      .maybeSingle()
      .then(({ data }: { data: { enabled: boolean } | null }) => {
        if (!active) return;
        setEnabled(!!data?.enabled);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    if (!canEdit) {
      toast.error("You do not have permission to change site visibility.");
      return;
    }
    const next = !enabled;
    try {
      await toggleBlogVisibility(next, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: userId,
      });
      setEnabled(next);
      toast.success(next ? "Blog is now visible on the site" : "Blog is now hidden from the site");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle visibility");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`size-9 rounded-xl grid place-items-center shrink-0 ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {enabled ? <Globe className="size-4" /> : <EyeOff className="size-4" />}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">Blog section visibility</div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {loading
              ? "Checking status…"
              : enabled
                ? "The blog is live and linked from navigation and the footer."
                : "The blog is hidden from navigation, the footer and direct links. Articles stay saved."}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={loading || !canEdit}
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle blog visibility"
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted border border-border"}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function BlogCMS() {
  const { user, role } = useAuth();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canCreate = permissions.canCreateProject(permCtx);
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDelete(permCtx);

  const [posts, setPosts] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const [deleteTarget, setDeleteTarget] = useState<BlogRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async (isBackground = false) => {
    if (!isBackground && posts.length === 0) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts((data as BlogRow[]) || []);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleTogglePublish = async (p: BlogRow) => {
    if (!canEdit) {
      toast.error("You do not have permission to publish articles.");
      return;
    }
    const next = !p.published;
    // Publishing with no date set means "live now", not "scheduled forever".
    const nextDate = next && !p.published_at ? new Date(Date.now() - 5000).toISOString() : p.published_at;
    try {
      const updated = await publishBlogPost(p.id, next, nextDate, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setPosts((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, published: updated.published, published_at: updated.published_at } : item,
        ),
      );
      toast.success(
        next
          ? `"${truncate(p.title, 40)}" published`
          : `"${truncate(p.title, 40)}" reverted to draft`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleToggleFeatured = async (p: BlogRow) => {
    if (!canEdit) return;
    const next = !p.featured;
    try {
      const updated = await setFeaturedBlogPost(p.id, next, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setPosts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, featured: updated.featured } : item)),
      );
      toast.success(next ? "Article will lead the blog" : "Removed from featured");
    } catch (err: any) {
      toast.error(err.message || "Failed to update featured flag");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await deleteBlogPost(deleteTarget.id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setPosts((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Deleted "${truncate(deleteTarget.title, 40)}"`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete article");
    } finally {
      setDeleting(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [posts]);

  const counts = useMemo(() => {
    let published = 0;
    let drafts = 0;
    let scheduled = 0;
    posts.forEach((p) => {
      const s = deriveStatus(p);
      if (s === "published") published++;
      else if (s === "scheduled") scheduled++;
      else drafts++;
    });
    return { total: posts.length, published, drafts, scheduled };
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = posts.filter((p) => {
      const status = deriveStatus(p);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (featuredFilter === "featured" && !p.featured) return false;
      if (featuredFilter === "standard" && p.featured) return false;
      if (!query) return true;
      return (
        p.title.toLowerCase().includes(query) ||
        (p.title_ar || "").toLowerCase().includes(query) ||
        (p.excerpt || "").toLowerCase().includes(query) ||
        (p.excerpt_ar || "").toLowerCase().includes(query) ||
        (p.author || "").toLowerCase().includes(query) ||
        p.slug.toLowerCase().includes(query) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(query))
      );
    });

    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "oldest")
      sorted.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    else if (sort === "order") sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
    else
      sorted.sort((a, b) =>
        (b.published_at || b.created_at || "").localeCompare(a.published_at || a.created_at || ""),
      );
    return sorted;
  }, [posts, search, statusFilter, categoryFilter, featuredFilter, sort]);

  const isFiltered =
    !!search.trim() ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    featuredFilter !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <ContentHeader
        eyebrow="SADA Editorial CMS"
        title="Blog"
        description="Build useful content that represents how SADA thinks."
        action={
          canCreate ? (
            <Link
              to="/admin/blog/$id"
              params={{ id: "new" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 shadow-sm transition-all shrink-0"
            >
              <Plus className="size-4" /> New Article
            </Link>
          ) : undefined
        }
      />

      <ContentKpiGrid
        items={[
          { label: "Published", value: counts.published, tone: "published", subtitle: "Live now" },
          { label: "Drafts", value: counts.drafts, tone: "draft", subtitle: "Needs attention" },
          { label: "Scheduled", value: counts.scheduled, tone: "scheduled", subtitle: "Waiting to go live" },
          { label: "Total", value: counts.total, tone: "neutral", subtitle: "All articles" },
        ]}
      />

      <BlogVisibilityCard
        canEdit={canEdit}
        permCtx={permCtx}
        currentRole={currentRole}
        userId={user?.id}
      />

      <ContentToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, excerpt, author, tag or slug..."
        activeTab={statusFilter}
        onTabChange={(v) => setStatusFilter(v as "all" | ContentStatus)}
        tabs={[
          { value: "all", label: "All", count: counts.total },
          { value: "published", label: "Published", count: counts.published, tone: "published" },
          { value: "draft", label: "Drafts", count: counts.drafts, tone: "draft" },
          { value: "scheduled", label: "Scheduled", count: counts.scheduled, tone: "scheduled" },
        ]}
        filters={[
          ...(categories.length > 0
            ? [
                {
                  key: "category",
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                  ariaLabel: "Filter by category",
                  options: [
                    { value: "all", label: "All categories" },
                    ...categories.map((c) => ({ value: c, label: c })),
                  ],
                },
              ]
            : []),
          {
            key: "featured",
            value: featuredFilter,
            onChange: setFeaturedFilter,
            ariaLabel: "Filter by featured",
            minWidth: "min-w-[130px]",
            options: [
              { value: "all", label: "All articles" },
              { value: "featured", label: "Featured only" },
              { value: "standard", label: "Not featured" },
            ],
          },
          {
            key: "sort",
            value: sort,
            onChange: (v) => setSort(v as SortKey),
            ariaLabel: "Sort articles",
            minWidth: "min-w-[140px]",
            options: SORT_OPTIONS,
          },
        ]}
      />

      {loading && posts.length === 0 ? (
        <ContentListSkeleton />
      ) : loadError ? (
        <ContentErrorState message={loadError} onRetry={fetchPosts} />
      ) : visiblePosts.length === 0 ? (
        <ContentEmptyState
          icon={PenLine}
          title={isFiltered ? "No articles match these filters" : "No articles yet."}
          description={
            isFiltered
              ? "Try a different search term, status or category."
              : "Publish useful ideas, insights, and strategic perspectives from SADA."
          }
          primaryAction={
            canCreate && !isFiltered
              ? { label: "Create your first article", to: "/admin/blog/$id", params: { id: "new" } }
              : undefined
          }
          secondaryAction={
            isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setFeaturedFilter("all");
                }}
                className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {visiblePosts.map((p) => {
            const status = deriveStatus(p);
            return (
              <article
                key={p.id}
                className="group rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-24 h-20 sm:w-28 sm:h-[76px] rounded-xl overflow-hidden bg-muted shrink-0 border border-border/60">
                    {p.cover_url ? (
                      <SmartMedia
                        src={p.cover_url}
                        className="w-full h-full object-cover"
                        autoplay={false}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground/50">
                        <PenLine className="size-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ContentStatusBadge status={status} />
                      {p.featured && <ContentFeaturedBadge />}
                      {p.category && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          {p.category}
                        </span>
                      )}
                      {p.title_ar && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          عربي
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug line-clamp-1">
                      {p.title}
                    </h3>
                    {p.title_ar && (
                      <div className="text-xs text-muted-foreground/80 font-medium line-clamp-1" dir="rtl">
                        {p.title_ar}
                      </div>
                    )}

                    {p.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {truncate(p.excerpt, 170)}
                      </p>
                    )}

                    <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pt-0.5">
                      {p.author && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" /> {p.author}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {status === "scheduled" ? (
                          <CalendarClock className="size-3" />
                        ) : (
                          <Clock className="size-3" />
                        )}
                        {status === "scheduled"
                          ? `Goes live ${formatDate(p.published_at)}`
                          : status === "published"
                            ? `Published ${formatDate(p.published_at)}`
                            : "Not published"}
                      </span>
                      <span>Updated {formatRelative(p.updated_at)}</span>
                      <span className="font-mono text-muted-foreground/70 truncate">
                        /blog/{p.slug}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40 w-full lg:w-auto justify-end">
                  <a
                    href={`/blog/${p.slug}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium inline-flex items-center gap-1.5"
                    title="Preview article"
                  >
                    <Eye className="size-4" />
                    <span className="hidden xl:inline">Preview</span>
                  </a>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(p)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                        p.published
                          ? "border-border text-muted-foreground hover:text-amber-600 hover:border-amber-300"
                          : "border-green-500/30 text-green-600 hover:bg-green-500/10"
                      }`}
                    >
                      {p.published ? "Unpublish" : "Publish"}
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(p)}
                      className={`p-2 rounded-xl border transition-colors ${
                        p.featured
                          ? "border-purple-500/30 text-purple-600 bg-purple-500/10"
                          : "border-border text-muted-foreground hover:text-purple-600 hover:border-purple-300"
                      }`}
                      title={p.featured ? "Remove from featured" : "Feature on the blog"}
                    >
                      <Star className={`size-4 ${p.featured ? "fill-current" : ""}`} />
                    </button>
                  )}

                  <Link
                    to="/admin/blog/$id"
                    params={{ id: p.id }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-all"
                  >
                    <Edit3 className="size-3.5" /> Edit
                  </Link>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete article"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently delete this article?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>"{truncate(deleteTarget?.title, 60)}"</strong> will be removed for good.
              </span>
              <span className="block text-xs text-muted-foreground">
                This cannot be undone. The public URL /blog/{deleteTarget?.slug} will stop working.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
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
