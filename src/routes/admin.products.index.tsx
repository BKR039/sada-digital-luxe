import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  ShoppingBag,
  Copy,
  ExternalLink,
  Tag,
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import {
  publishDigitalProduct,
  setFeaturedDigitalProduct,
  duplicateDigitalProduct,
  deleteDigitalProduct,
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
  formatPrice,
  formatRelative,
  truncate,
  slugify,
  SORT_OPTIONS,
  type SortKey,
} from "@/components/admin/content/content-utils";

export const Route = createFileRoute("/admin/products/")({
  component: ProductsCMS,
});

interface ProductRow {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string | null;
  description: string | null;
  description_ar?: string | null;
  full_description: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  thumbnail_url: string | null;
  gumroad_url: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function ProductsCMS() {
  const { user, role } = useAuth();
  const nav = useNavigate();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canCreate = permissions.canCreateProject(permCtx);
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDelete(permCtx);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("order");

  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async (isBackground = false) => {
    if (!isBackground && products.length === 0) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts((data as ProductRow[]) || []);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleTogglePublish = async (p: ProductRow) => {
    if (!canEdit) {
      toast.error("You do not have permission to publish products.");
      return;
    }
    const next = !p.published;
    try {
      await publishDigitalProduct(p.id, next, { actorRole: currentRole, actorId: user?.id });
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, published: next } : item)),
      );
      toast.success(
        next
          ? `"${truncate(p.title, 40)}" is live in the store`
          : `"${truncate(p.title, 40)}" reverted to draft`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleToggleFeatured = async (p: ProductRow) => {
    if (!canEdit) return;
    const next = !p.featured;
    try {
      await setFeaturedDigitalProduct(p.id, next, { actorRole: currentRole, actorId: user?.id });
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, featured: next } : item)),
      );
      toast.success(next ? "Marked as featured" : "Removed from featured");
    } catch (err: any) {
      toast.error(err.message || "Failed to update featured flag");
    }
  };

  /** Duplicates as an unpublished draft so a copy can never go live by accident. */
  const handleDuplicate = async (p: ProductRow) => {
    if (!canCreate) return;
    setDuplicatingId(p.id);
    try {
      const duplicated = await duplicateDigitalProduct(p.id, {
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Duplicated as a draft");
      nav({ to: "/admin/products/$id", params: { id: duplicated.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate product");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await deleteDigitalProduct(deleteTarget.id, {
        actorRole: currentRole,
        actorId: user?.id,
      });
      setProducts((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Deleted "${truncate(deleteTarget.title, 40)}"`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const counts = useMemo(() => {
    const published = products.filter((p) => p.published).length;
    const featured = products.filter((p) => p.featured).length;
    return { total: products.length, published, drafts: products.length - published, featured };
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (statusFilter === "published" && !p.published) return false;
      if (statusFilter === "draft" && p.published) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        p.title.toLowerCase().includes(query) ||
        (p.title_ar || "").toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query) ||
        (p.description_ar || "").toLowerCase().includes(query) ||
        (p.category || "").toLowerCase().includes(query) ||
        (p.slug || "").toLowerCase().includes(query)
      );
    });

    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "oldest")
      sorted.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    else if (sort === "recent")
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    else sorted.sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [products, search, statusFilter, categoryFilter, sort]);

  const isFiltered = !!search.trim() || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <ContentHeader
        eyebrow="SADA Digital Products"
        title="Digital Products"
        description="What SADA sells."
        action={
          canCreate ? (
            <Link
              to="/admin/products/$id"
              params={{ id: "new" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 shadow-sm transition-all shrink-0"
            >
              <Plus className="size-4" /> New Product
            </Link>
          ) : undefined
        }
      />

      <ContentKpiGrid
        items={[
          { label: "Published", value: counts.published, tone: "published", subtitle: "Live in store" },
          { label: "Drafts", value: counts.drafts, tone: "draft", subtitle: "Unpublished offers" },
          { label: "Featured", value: counts.featured, tone: "featured", subtitle: "Storefront highlights" },
          { label: "Total products", value: counts.total, tone: "neutral", subtitle: "Full catalog" },
        ]}
      />

      <ContentToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, description, category or slug..."
        activeTab={statusFilter}
        onTabChange={(v) => setStatusFilter(v as "all" | "published" | "draft")}
        tabs={[
          { value: "all", label: "All", count: counts.total },
          { value: "published", label: "Published", count: counts.published, tone: "published" },
          { value: "draft", label: "Drafts", count: counts.drafts, tone: "draft" },
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
            key: "sort",
            value: sort,
            onChange: (v) => setSort(v as SortKey),
            ariaLabel: "Sort products",
            minWidth: "min-w-[140px]",
            options: SORT_OPTIONS,
          },
        ]}
      />

      {loading && products.length === 0 ? (
        <ContentListSkeleton />
      ) : loadError ? (
        <ContentErrorState message={loadError} onRetry={fetchProducts} />
      ) : visibleProducts.length === 0 ? (
        <ContentEmptyState
          icon={ShoppingBag}
          title={isFiltered ? "No products match these filters" : "No digital products yet."}
          description={
            isFiltered
              ? "Try a different search term, status or category."
              : "Create products that turn SADA's expertise into scalable offers."
          }
          primaryAction={
            canCreate && !isFiltered
              ? {
                  label: "Create your first product",
                  to: "/admin/products/$id",
                  params: { id: "new" },
                }
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
          {visibleProducts.map((p) => (
            <article
              key={p.id}
              className="group rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="size-20 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/60">
                  {p.thumbnail_url ? (
                    <SmartMedia
                      src={p.thumbnail_url}
                      className="w-full h-full object-cover"
                      autoplay={false}
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground/50">
                      <ShoppingBag className="size-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ContentStatusBadge status={p.published ? "published" : "draft"} />
                    {p.featured && <ContentFeaturedBadge />}
                    {p.title_ar && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        عربي
                      </span>
                    )}
                    {p.category && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-wider">
                        <Tag className="size-3" /> {p.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug line-clamp-1">
                        {p.title}
                      </h3>
                      {p.title_ar && (
                        <p className="text-xs text-muted-foreground/80 font-arabic line-clamp-1" dir="rtl">
                          {p.title_ar}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-base font-bold text-foreground shrink-0 px-2.5 py-0.5 rounded-lg bg-muted/60 border border-border/80">
                      {formatPrice(p.price, p.currency)}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {truncate(p.description, 150)}
                    </p>
                  )}

                  <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pt-0.5">
                    <span>Updated {formatRelative(p.updated_at)}</span>
                    <span className="font-mono text-muted-foreground/70 truncate">
                      /store/{p.slug || p.id}
                    </span>
                    {p.gumroad_url ? (
                      <a
                        href={p.gumroad_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ExternalLink className="size-3" /> Checkout Active
                      </a>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Missing checkout link
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40 w-full lg:w-auto justify-end">
                <a
                  href={`/store/${p.slug || p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                  title="Preview product page"
                >
                  <Eye className="size-4" />
                </a>

                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleDuplicate(p)}
                    disabled={duplicatingId === p.id}
                    className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="Duplicate as draft"
                  >
                    <Copy className="size-4" />
                  </button>
                )}

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
                    title={p.featured ? "Remove from featured" : "Feature in the store"}
                  >
                    <Star className={`size-4 ${p.featured ? "fill-current" : ""}`} />
                  </button>
                )}

                <Link
                  to="/admin/products/$id"
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
                    title="Delete product"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently delete this product?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>"{truncate(deleteTarget?.title, 60)}"</strong> will be removed for good.
              </span>
              <span className="block text-xs text-muted-foreground">
                This cannot be undone. Existing Gumroad purchases are unaffected, but the product
                page will stop working.
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
