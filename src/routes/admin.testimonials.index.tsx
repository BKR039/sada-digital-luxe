import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus,
  Edit3,
  Trash2,
  Star,
  AlertTriangle,
  Quote,
  Building2,
  FolderKanban,
  Briefcase,
  Languages,
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import {
  publishTestimonial,
  setFeaturedTestimonial,
  deleteTestimonial,
  validateTestimonialReadiness,
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
  formatRelative,
  truncate,
  SORT_OPTIONS,
  type SortKey,
} from "@/components/admin/content/content-utils";

export const Route = createFileRoute("/admin/testimonials/")({
  component: ClientProofCMS,
});

interface TestimonialRow {
  id: string;
  client_name: string;
  company: string | null;
  role: string | null;
  photo_url: string | null;
  review: string;
  short_quote: string | null;
  rating?: number;
  language: string;
  service: string | null;
  client_id: string | null;
  project_id: string | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function ClientProofCMS() {
  const { user, role } = useAuth();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canCreate = permissions.canCreateProject(permCtx);
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDelete(permCtx);

  const [items, setItems] = useState<TestimonialRow[]>([]);
  const [projectTitles, setProjectTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("order");

  const [deleteTarget, setDeleteTarget] = useState<TestimonialRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async (forceLoading = false) => {
    if (forceLoading || items.length === 0) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("testimonials")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data as TestimonialRow[]) || [];
      setItems(rows);

      // Resolve linked case study titles by reference — never copied onto the row.
      const projectIds = Array.from(
        new Set(rows.map((r) => r.project_id).filter(Boolean)),
      ) as string[];
      if (projectIds.length > 0) {
        const { data: projects } = await (supabase as any)
          .from("projects")
          .select("id, title")
          .in("id", projectIds);
        const map: Record<string, string> = {};
        (projects || []).forEach((p: { id: string; title: string }) => {
          map[p.id] = p.title;
        });
        setProjectTitles(map);
      }
    } catch (err: any) {
      setLoadError(err.message || "Failed to load client proof");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleTogglePublish = async (t: TestimonialRow) => {
    if (!canEdit) {
      toast.error("You do not have permission to publish client proof.");
      return;
    }
    const next = !t.published;
    if (next) {
      const readiness = validateTestimonialReadiness(t);
      if (!readiness.allPassed) {
        const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
        toast.error(`Cannot publish ${t.client_name}: missing readiness criteria (${missing}). Open the editor to complete attribution.`);
        return;
      }
    }
    try {
      await publishTestimonial(t.id, next, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, published: next } : item)),
      );
      toast.success(
        next ? `${t.client_name}'s quote is live` : `${t.client_name}'s quote reverted to draft`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleToggleFeatured = async (t: TestimonialRow) => {
    if (!canEdit) return;
    const next = !t.featured;
    try {
      await setFeaturedTestimonial(t.id, next, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, featured: next } : item)),
      );
      toast.success(next ? "Marked as featured proof" : "Removed from featured");
    } catch (err: any) {
      toast.error(err.message || "Failed to update featured flag");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await deleteTestimonial(deleteTarget.id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.client_name}'s quote`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client proof");
    } finally {
      setDeleting(false);
    }
  };

  const services = useMemo(() => {
    const set = new Set<string>();
    items.forEach((t) => t.service && set.add(t.service));
    return Array.from(set).sort();
  }, [items]);

  const counts = useMemo(() => {
    const published = items.filter((t) => t.published).length;
    const featured = items.filter((t) => t.featured).length;
    return { total: items.length, published, drafts: items.length - published, featured };
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = items.filter((t) => {
      if (statusFilter === "published" && !t.published) return false;
      if (statusFilter === "draft" && t.published) return false;
      if (serviceFilter !== "all" && t.service !== serviceFilter) return false;
      if (!query) return true;
      return (
        t.client_name.toLowerCase().includes(query) ||
        (t.company || "").toLowerCase().includes(query) ||
        (t.role || "").toLowerCase().includes(query) ||
        t.review.toLowerCase().includes(query)
      );
    });

    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.client_name.localeCompare(b.client_name));
    else if (sort === "oldest")
      sorted.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    else if (sort === "recent")
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    else sorted.sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [items, search, statusFilter, serviceFilter, sort]);

  const isFiltered = !!search.trim() || statusFilter !== "all" || serviceFilter !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <ContentHeader
        eyebrow="SADA Client Proof"
        title="Client Proof"
        description="Real words from real clients."
        action={
          canCreate ? (
            <Link
              to="/admin/testimonials/$id"
              params={{ id: "new" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 shadow-sm transition-all shrink-0"
            >
              <Plus className="size-4" /> New Client Proof
            </Link>
          ) : undefined
        }
      />

      <ContentKpiGrid
        items={[
          { label: "Published", value: counts.published, tone: "published", subtitle: "Visible on site" },
          { label: "Drafts", value: counts.drafts, tone: "draft", subtitle: "Unpublished proof" },
          { label: "Featured", value: counts.featured, tone: "featured", subtitle: "Featured endorsements" },
          { label: "Total", value: counts.total, tone: "neutral", subtitle: "Total testimonials" },
        ]}
      />

      <ContentToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by client, company, role or quote..."
        activeTab={statusFilter}
        onTabChange={(v) => setStatusFilter(v as "all" | "published" | "draft")}
        tabs={[
          { value: "all", label: "All", count: counts.total },
          { value: "published", label: "Published", count: counts.published, tone: "published" },
          { value: "draft", label: "Drafts", count: counts.drafts, tone: "draft" },
        ]}
        filters={[
          ...(services.length > 0
            ? [
                {
                  key: "service",
                  value: serviceFilter,
                  onChange: setServiceFilter,
                  ariaLabel: "Filter by service",
                  options: [
                    { value: "all", label: "All services" },
                    ...services.map((s) => ({ value: s, label: s })),
                  ],
                },
              ]
            : []),
          {
            key: "sort",
            value: sort,
            onChange: (v) => setSort(v as SortKey),
            ariaLabel: "Sort client proof",
            minWidth: "min-w-[140px]",
            options: SORT_OPTIONS,
          },
        ]}
      />

      {(loading && items.length === 0) ? (
        <ContentListSkeleton />
      ) : loadError ? (
        <ContentErrorState message={loadError} onRetry={fetchItems} />
      ) : visibleItems.length === 0 ? (
        <ContentEmptyState
          icon={Quote}
          title={isFiltered ? "No client proof matches these filters" : "No client proof yet."}
          description={
            isFiltered
              ? "Try a different search term, status or service."
              : "Add verified feedback from real SADA clients. If a quote cannot be verified, leave it unpublished."
          }
          primaryAction={
            canCreate && !isFiltered
              ? {
                  label: "Add your first client proof",
                  to: "/admin/testimonials/$id",
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
                  setServiceFilter("all");
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
          {visibleItems.map((t) => (
            <article
              key={t.id}
              className="group rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="size-14 rounded-full overflow-hidden bg-muted shrink-0 border border-border/60">
                  {t.photo_url ? (
                    <SmartMedia
                      src={t.photo_url}
                      className="w-full h-full object-cover"
                      autoplay={false}
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-base font-bold font-display text-muted-foreground/60">
                      {t.client_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ContentStatusBadge status={t.published ? "published" : "draft"} />
                    {t.featured && <ContentFeaturedBadge />}
                  </div>

                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-foreground">{t.client_name}</h3>
                    {(t.role || t.company) && (
                      <span className="text-xs text-muted-foreground">
                        {[t.role, t.company].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>

                  <p
                    dir={t.language === "ar" ? "rtl" : "ltr"}
                    className="text-sm text-muted-foreground line-clamp-2 leading-relaxed italic"
                  >
                    "{truncate(t.short_quote || t.review, 180)}"
                  </p>

                  <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pt-0.5">
                    {t.service && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="size-3" /> {t.service}
                      </span>
                    )}
                    {t.project_id && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <FolderKanban className="size-3" />
                        {projectTitles[t.project_id] || "Linked case study"}
                      </span>
                    )}
                    {t.client_id && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" /> Linked CRM client
                      </span>
                    )}
                    {t.language && t.language !== "en" && (
                      <span className="inline-flex items-center gap-1 uppercase">
                        <Languages className="size-3" /> {t.language}
                      </span>
                    )}
                    <span>Updated {formatRelative(t.updated_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40 w-full lg:w-auto justify-end">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(t)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      t.published
                        ? "border-border text-muted-foreground hover:text-amber-600 hover:border-amber-300"
                        : "border-green-500/30 text-green-600 hover:bg-green-500/10"
                    }`}
                  >
                    {t.published ? "Unpublish" : "Publish"}
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(t)}
                    className={`p-2 rounded-xl border transition-colors ${
                      t.featured
                        ? "border-purple-500/30 text-purple-600 bg-purple-500/10"
                        : "border-border text-muted-foreground hover:text-purple-600 hover:border-purple-300"
                    }`}
                    title={t.featured ? "Remove from featured" : "Feature this proof"}
                  >
                    <Star className={`size-4 ${t.featured ? "fill-current" : ""}`} />
                  </button>
                )}

                <Link
                  to="/admin/testimonials/$id"
                  params={{ id: t.id }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-all"
                >
                  <Edit3 className="size-3.5" /> Edit
                </Link>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(t)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete client proof"
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
              <AlertTriangle className="size-5" /> Permanently delete this client proof?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {deleteTarget?.client_name}'s quote will be removed for good.
              </span>
              <span className="block text-xs text-muted-foreground">
                Any case study that references it will fall back to its own stored quote. This
                cannot be undone.
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
