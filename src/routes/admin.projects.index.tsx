import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus, Search, Filter, ExternalLink, Edit3, Eye, Trash2,
  Sparkles, CheckCircle2, Clock, Globe, ArrowRight, Image as ImageIcon,
  Check, X, AlertTriangle, Layers, Building2, Tag, Star
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import {
  publishProjectItem,
  updateProjectItem,
  deleteProjectItem,
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
import { SADASelect } from "@/components/ui/sada-select";
import { SkeletonTable, SADASearch } from "@/components/ui/sada-ui";

export const Route = createFileRoute("/admin/projects/")({
  component: ProjectsListCMS,
});

interface ProjectCMSItem {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  industry: string | null;
  category: string | null;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  services: string[] | null;
  published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

function ProjectsListCMS() {
  const { user, role } = useAuth();
  const nav = useNavigate();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canCreate = permissions.canCreateProject(permCtx);
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDeleteProject(permCtx);

  const [projects, setProjects] = useState<ProjectCMSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<ProjectCMSItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load projects
  const fetchProjects = async (forceLoading = false) => {
    if (forceLoading || projects.length === 0) {
      setLoading(true);
    }
    try {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects((data as ProjectCMSItem[]) || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load case studies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Quick toggle publish / unpublish
  const handleTogglePublish = async (p: ProjectCMSItem) => {
    if (!canEdit) {
      toast.error("You don't have permission to publish or unpublish case studies");
      return;
    }
    const newStatus = !p.published;
    try {
      await publishProjectItem(p.id, newStatus, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setProjects((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, published: newStatus } : item))
      );
      toast.success(newStatus ? `"${p.title}" published` : `"${p.title}" reverted to draft`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Quick toggle featured on homepage
  const handleToggleFeatured = async (p: ProjectCMSItem) => {
    if (!canEdit) return;
    const newFeatured = !p.featured;
    try {
      await updateProjectItem(p.id, { featured: newFeatured }, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setProjects((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, featured: newFeatured } : item))
      );
      toast.success(newFeatured ? "Marked as featured on homepage" : "Removed from homepage");
    } catch (err: any) {
      toast.error(err.message || "Failed to update featured flag");
    }
  };

  // Delete project
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await deleteProjectItem(deleteTarget.id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      setProjects((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Deleted case study "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete case study");
    } finally {
      setDeleting(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    projects.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter === "published" && !p.published) return false;
      if (statusFilter === "draft" && p.published) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(query);
        const matchClient = p.client?.toLowerCase().includes(query) || false;
        const matchIndustry = p.industry?.toLowerCase().includes(query) || false;
        const matchSlug = p.slug.toLowerCase().includes(query);
        if (!matchTitle && !matchClient && !matchIndustry && !matchSlug) return false;
      }

      return true;
    });
  }, [projects, statusFilter, categoryFilter, searchQuery]);

  const counts = useMemo(() => {
    const total = projects.length;
    const published = projects.filter((p) => p.published).length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [projects]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
            <Sparkles className="size-3.5" /> SADA Portfolio CMS
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Case Studies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage public portfolio projects, dynamic case study stories, and media.
          </p>
        </div>

        {canCreate && (
          <Link
            to="/admin/projects/$id"
            params={{ id: "new" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 shadow-sm transition-all"
          >
            <Plus className="size-4" /> New Case Study
          </Link>
        )}
      </div>

      {/* METRIC PILLS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="p-2.5 sm:p-4 rounded-2xl border border-border/70 bg-card/60 min-w-0">
          <div className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-muted-foreground truncate">Total Projects</div>
          <div className="text-xl sm:text-3xl font-bold font-display mt-0.5 sm:mt-1">{counts.total}</div>
        </div>
        <div className="p-2.5 sm:p-4 rounded-2xl border border-border/70 bg-card/60 min-w-0">
          <div className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-green-600 dark:text-green-400 truncate">Published</div>
          <div className="text-xl sm:text-3xl font-bold font-display text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">
            {counts.published}
          </div>
        </div>
        <div className="p-2.5 sm:p-4 rounded-2xl border border-border/70 bg-card/60 min-w-0">
          <div className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 truncate">Drafts</div>
          <div className="text-xl sm:text-3xl font-bold font-display text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-1">
            {counts.drafts}
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card/40">
        <div className="flex-1 max-w-md">
          <SADASearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title, client, industry or slug..."
            size="compact"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "all" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("published")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "published" ? "bg-card text-green-600 dark:text-green-400 shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Published ({counts.published})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === "draft" ? "bg-card text-amber-600 dark:text-amber-400 shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Drafts ({counts.drafts})
            </button>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <SADASelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="compact"
              className="w-auto min-w-[140px]"
              options={[
                { value: "all", label: "All Categories" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}
        </div>
      </div>

      {/* CASE STUDIES LIST */}
      {(loading && projects.length === 0) ? (
        <SkeletonTable rows={5} cols={5} />
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="size-12 rounded-2xl bg-muted grid place-items-center mx-auto text-muted-foreground mb-3">
            <ImageIcon className="size-6" />
          </div>
          <h3 className="text-lg font-bold">No case studies found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery.trim() || statusFilter !== "all" || categoryFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "Start by creating your first portfolio case study to showcase SADA's client work."}
          </p>
          {canCreate && (
            <Link
              to="/admin/projects/$id"
              params={{ id: "new" }}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
            >
              <Plus className="size-4" /> Create Case Study
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((p) => {
            const hasCover = !!(p.thumbnail_url || p.cover_url);
            const services = Array.isArray(p.services) ? p.services : [];

            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="size-18 sm:size-20 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/60">
                    {hasCover ? (
                      <SmartMedia src={p.thumbnail_url || p.cover_url} className="w-full h-full object-cover" autoplay={false} />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xl font-bold font-display text-muted-foreground/50">
                        {p.title.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          p.published
                            ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${p.published ? "bg-green-500" : "bg-amber-500"}`} />
                        {p.published ? "Published" : "Draft"}
                      </span>

                      {p.featured && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          <Star className="size-3 fill-current" /> Featured
                        </span>
                      )}

                      {p.industry && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          {p.industry}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-foreground truncate">{p.title}</h3>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap min-w-0">
                      {p.client && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Building2 className="size-3" /> {p.client}
                        </span>
                      )}
                      <span className="font-mono text-muted-foreground/70 truncate max-w-[200px] sm:max-w-xs">/case-studies/{p.slug}</span>
                    </div>

                    {services.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {services.slice(0, 3).map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                            {s}
                          </span>
                        ))}
                        {services.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-medium">+{services.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 w-full sm:w-auto justify-end">
                  {/* Preview Button */}
                  <a
                    href={`/case-studies/${p.slug}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium inline-flex items-center gap-1.5"
                    title="Preview Case Study"
                  >
                    <Eye className="size-4" />
                    <span className="hidden md:inline">Preview</span>
                  </a>

                  {/* Toggle Publish */}
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

                  {/* Toggle Featured */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(p)}
                      className={`p-2 rounded-xl border transition-colors ${
                        p.featured
                          ? "border-purple-500/30 text-purple-600 bg-purple-500/10"
                          : "border-border text-muted-foreground hover:text-purple-600 hover:border-purple-300"
                      }`}
                      title={p.featured ? "Remove from Homepage" : "Feature on Homepage"}
                    >
                      <Star className={`size-4 ${p.featured ? "fill-current" : ""}`} />
                    </button>
                  )}

                  {/* Edit Full Page */}
                  <Link
                    to="/admin/projects/$id"
                    params={{ id: p.id }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-all"
                  >
                    <Edit3 className="size-3.5" /> Edit
                  </Link>

                  {/* Delete (Super Admin only) */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete Case Study"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM DELETE MODAL (AlertDialog) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently Delete Case Study?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                This action is permanent and cannot be undone. Public URLs and references to this project will become unavailable.
              </p>
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
              {deleting ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
