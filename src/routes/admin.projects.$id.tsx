import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Eye, CheckCircle2, Globe, Trash2, Plus, X,
  AlertTriangle, Target, Flag, Lightbulb, Layers, FileText, Image as ImageIcon,
  Users, Quote, Search, Sparkles, ExternalLink, ShieldCheck, Check,
  ChevronRight, Calendar, Building2, HelpCircle
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import {
  createProjectItem,
  updateProjectItem,
  deleteProjectItem,
} from "@/lib/content-service";
import { MediaUpload, MediaUploadMulti } from "@/components/media/MediaUpload";
import { DIVISIONS } from "@/data/services";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADASwitch, SADACounter } from "@/components/ui/sada-ui";

export const Route = createFileRoute("/admin/projects/$id")({
  component: ProjectEditorWorkspace,
});

interface MetricItem {
  value: string;
  label: string;
  period?: string;
  source?: string;
}

interface TestimonialData {
  quote: string;
  name: string;
  role?: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
  position: string | null;
  division: string | null;
  photo_url: string | null;
}

interface TestimonialOption {
  id: string;
  client_name: string;
  company: string | null;
  review: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type EditorSectionKey =
  | "overview"
  | "story"
  | "services"
  | "results"
  | "media"
  | "team"
  | "testimonial"
  | "seo";

const SECTIONS: { id: EditorSectionKey; label: string; icon: any }[] = [
  { id: "overview", label: "Overview & Basics", icon: FileText },
  { id: "story", label: "Project Story", icon: Target },
  { id: "services", label: "Services & Deliverables", icon: Layers },
  { id: "results", label: "Results & Proof", icon: CheckCircle2 },
  { id: "media", label: "Media & Gallery", icon: ImageIcon },
  { id: "team", label: "Team Members", icon: Users },
  { id: "testimonial", label: "Client Testimonial", icon: Quote },
  { id: "seo", label: "SEO & Social", icon: Search },
];

function ProjectEditorWorkspace() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const { user, role } = useAuth();
  const nav = useNavigate();
  const currentRole = normalizeRole(role);
  const permCtx = { role: currentRole, userId: user?.id };
  const canEdit = permissions.canEditProject(permCtx);
  const canDelete = permissions.canDeleteProject(permCtx);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<EditorSectionKey>("overview");

  // Project Fields State
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [client, setClient] = useState("");
  const [clientAr, setClientAr] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryAr, setIndustryAr] = useState("");
  const [category, setCategory] = useState("Marketing · Development · Production");
  const [categoryAr, setCategoryAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState(10);

  // Story Fields
  const [challenge, setChallenge] = useState("");
  const [challengeAr, setChallengeAr] = useState("");
  const [objective, setObjective] = useState("");
  const [objectiveAr, setObjectiveAr] = useState("");
  const [strategy, setStrategy] = useState("");
  const [strategyAr, setStrategyAr] = useState("");
  const [process, setProcess] = useState("");
  const [processAr, setProcessAr] = useState("");

  // Services & Deliverables
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverableInput, setNewDeliverableInput] = useState("");

  // Results & Proof
  const [resultsText, setResultsText] = useState("");
  const [resultsAr, setResultsAr] = useState("");
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [externalUrl, setExternalUrl] = useState("");

  // Media
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  // Team
  const [availableTeam, setAvailableTeam] = useState<TeamMemberOption[]>([]);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);

  // Testimonials
  const [availableTestimonials, setAvailableTestimonials] = useState<TestimonialOption[]>([]);
  const [selectedTestimonialId, setSelectedTestimonialId] = useState("");
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialName, setTestimonialName] = useState("");
  const [testimonialRole, setTestimonialRole] = useState("");

  // SEO Overrides
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  // Publish checklist modal
  const [showPublishChecklist, setShowPublishChecklist] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load team members and testimonials options
  useEffect(() => {
    async function loadOptions() {
      const [teamRes, testRes] = await Promise.all([
        (supabase as any)
          .from("team_members")
          .select("id, name, position, division, photo_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        (supabase as any)
          .from("testimonials")
          .select("id, client_name, company, review")
          .order("created_at", { ascending: false }),
      ]);

      if (teamRes.data) setAvailableTeam(teamRes.data);
      if (testRes.data) setAvailableTestimonials(testRes.data);
    }
    loadOptions();
  }, []);

  // Load existing project if editing
  useEffect(() => {
    if (isNew) return;

    async function loadProject() {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) throw error || new Error("Project not found");

        setTitle(data.title || "");
        setTitleAr(data.title_ar || "");
        setSlug(data.slug || "");
        setSlugManuallyEdited(true);
        setClient(data.client || "");
        setClientAr(data.client_ar || "");
        setIndustry(data.industry || "");
        setIndustryAr(data.industry_ar || "");
        setCategory(data.category || "Marketing · Development · Production");
        setCategoryAr(data.category_ar || "");
        setDescription(data.description || "");
        setDescriptionAr(data.description_ar || "");
        setProjectDate(data.project_date ? data.project_date.split("T")[0] : "");
        setFeatured(!!data.featured);
        setPublished(!!data.published);
        setSortOrder(data.sort_order ?? 10);

        setChallenge(data.challenge || "");
        setChallengeAr(data.challenge_ar || "");
        setObjective(data.objective || "");
        setObjectiveAr(data.objective_ar || "");
        setStrategy(data.strategy || "");
        setStrategyAr(data.strategy_ar || "");
        setProcess(data.process || "");
        setProcessAr(data.process_ar || "");

        setSelectedServices(Array.isArray(data.services) ? data.services : []);
        setDeliverables(Array.isArray(data.deliverables) ? data.deliverables : []);

        setResultsText(data.results || "");
        setResultsAr(data.results_ar || "");
        setMetrics(Array.isArray(data.metrics) ? data.metrics : []);
        setExternalUrl(data.external_url || "");

        setThumbnailUrl(data.thumbnail_url || null);
        setCoverUrl(data.cover_url || null);
        setGallery(Array.isArray(data.gallery) ? data.gallery : []);
        setBeforeUrl(data.before_url || null);
        setAfterUrl(data.after_url || null);

        setSelectedTeamMemberIds(Array.isArray(data.team_member_ids) ? data.team_member_ids : []);

        // Check for canonical linked testimonial first
        const { data: linkedTestimonial } = await (supabase as any)
          .from("testimonials")
          .select("id, client_name, company, role, review, short_quote")
          .eq("project_id", id)
          .maybeSingle();

        if (linkedTestimonial) {
          setSelectedTestimonialId(linkedTestimonial.id);
          setTestimonialQuote(linkedTestimonial.short_quote || linkedTestimonial.review || "");
          setTestimonialName(linkedTestimonial.client_name || "");
          setTestimonialRole([linkedTestimonial.role, linkedTestimonial.company].filter(Boolean).join(", ") || "");
        } else if (data.testimonial && typeof data.testimonial === "object") {
          setTestimonialQuote(data.testimonial.quote || "");
          setTestimonialName(data.testimonial.name || "");
          setTestimonialRole(data.testimonial.role || "");
        }

        setSeoTitle(data.seo_title || "");
        setSeoDescription(data.seo_description || "");
      } catch (err: any) {
        toast.error(err.message || "Failed to load project");
        nav({ to: "/admin/projects" });
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id, isNew]);

  // Auto-generate slug from title if not manually edited
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  // Toggle service selection
  const handleToggleService = (sName: string) => {
    setSelectedServices((prev) =>
      prev.includes(sName) ? prev.filter((s) => s !== sName) : [...prev, sName]
    );
  };

  // Add custom service
  const handleAddCustomService = () => {
    const trimmed = customServiceInput.trim();
    if (!trimmed) return;
    if (!selectedServices.includes(trimmed)) {
      setSelectedServices((prev) => [...prev, trimmed]);
    }
    setCustomServiceInput("");
  };

  // Deliverables handlers
  const handleAddDeliverable = () => {
    const trimmed = newDeliverableInput.trim();
    if (!trimmed) return;
    if (!deliverables.includes(trimmed)) {
      setDeliverables((prev) => [...prev, trimmed]);
    }
    setNewDeliverableInput("");
  };

  const handleRemoveDeliverable = (item: string) => {
    setDeliverables((prev) => prev.filter((d) => d !== item));
  };

  // Metrics handlers
  const handleAddMetric = () => {
    setMetrics((prev) => [...prev, { value: "+50%", label: "Result Metric", period: "3 months" }]);
  };

  const handleUpdateMetric = (index: number, key: keyof MetricItem, value: string) => {
    setMetrics((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleRemoveMetric = (index: number) => {
    setMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  // Team selection toggle
  const handleToggleTeamMember = (memberId: string) => {
    setSelectedTeamMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((m) => m !== memberId) : [...prev, memberId]
    );
  };

  // Testimonial from existing picker
  const handleSelectExistingTestimonial = (testId: string) => {
    setSelectedTestimonialId(testId);
    if (!testId) {
      setTestimonialQuote("");
      setTestimonialName("");
      setTestimonialRole("");
      return;
    }
    const found = availableTestimonials.find((t) => t.id === testId);
    if (found) {
      setTestimonialQuote(found.review);
      setTestimonialName(found.client_name);
      setTestimonialRole(found.company || "");
      toast.success("Linked testimonial from database");
    }
  };

  // Publish Checklist Evaluation
  const checklist = useMemo(() => {
    const checks = [
      { id: "title", label: "Project Title is set", passed: title.trim().length > 0 },
      { id: "slug", label: "Unique and valid URL Slug", passed: slug.trim().length > 0 && /^[a-z0-9-]+$/.test(slug) },
      { id: "client", label: "Client or Project Name", passed: (client.trim().length > 0 || title.trim().length > 0) },
      { id: "desc", label: "Short Description / Overview", passed: description.trim().length > 10 },
      { id: "media", label: "Cover or Thumbnail image uploaded", passed: !!(thumbnailUrl || coverUrl) },
      {
        id: "story",
        label: "Story narrative or services defined",
        passed:
          challenge.trim().length > 0 ||
          objective.trim().length > 0 ||
          strategy.trim().length > 0 ||
          selectedServices.length > 0,
      },
    ];
    const allPassed = checks.every((c) => c.passed);
    return { checks, allPassed };
  }, [title, slug, client, description, thumbnailUrl, coverUrl, challenge, objective, strategy, selectedServices]);

  // Core Save Logic
  const handleSave = async (targetPublishState?: boolean) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit case studies.");
      return;
    }

    const nextPublished = targetPublishState !== undefined ? targetPublishState : published;

    // Minimum check even for draft
    if (!title.trim()) {
      toast.error("Please provide at least a Project Title.");
      setActiveSection("overview");
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    if (!finalSlug) {
      toast.error("Please provide a valid slug.");
      setActiveSection("overview");
      return;
    }

    // If publishing, check validation checklist
    if (nextPublished && !checklist.allPassed) {
      setShowPublishChecklist(true);
      return;
    }

    setSaving(true);
    try {
      // Check slug uniqueness
      let slugCheck = (supabase as any)
        .from("projects")
        .select("id")
        .eq("slug", finalSlug);

      if (!isNew) {
        slugCheck = slugCheck.neq("id", id);
      }

      const { data: existingSlugRows } = await slugCheck;
      if (existingSlugRows && existingSlugRows.length > 0) {
        toast.error(`The slug "${finalSlug}" is already used by another project. Please use a unique slug.`);
        setActiveSection("overview");
        setSaving(false);
        return;
      }

      const payload: Record<string, any> = {
        title: title.trim(),
        title_ar: titleAr.trim() || null,
        slug: finalSlug,
        client: client.trim() || null,
        client_ar: clientAr.trim() || null,
        industry: industry.trim() || null,
        industry_ar: industryAr.trim() || null,
        category: category.trim() || null,
        category_ar: categoryAr.trim() || null,
        description: description.trim() || null,
        description_ar: descriptionAr.trim() || null,
        project_date: projectDate || null,
        featured,
        published: nextPublished,
        sort_order: sortOrder,

        challenge: challenge.trim() || null,
        challenge_ar: challengeAr.trim() || null,
        objective: objective.trim() || null,
        objective_ar: objectiveAr.trim() || null,
        strategy: strategy.trim() || null,
        strategy_ar: strategyAr.trim() || null,
        process: process.trim() || null,
        process_ar: processAr.trim() || null,

        services: selectedServices,
        deliverables: deliverables,

        results: resultsText.trim() || null,
        results_ar: resultsAr.trim() || null,
        metrics: metrics.filter((m) => m.value.trim() && m.label.trim()),
        external_url: externalUrl.trim() || null,

        thumbnail_url: thumbnailUrl,
        cover_url: coverUrl,
        gallery: gallery,
        before_url: beforeUrl,
        after_url: afterUrl,

        team_member_ids: selectedTeamMemberIds,

        testimonial:
          testimonialQuote.trim() && testimonialName.trim()
            ? {
                quote: testimonialQuote.trim(),
                name: testimonialName.trim(),
                role: testimonialRole.trim() || undefined,
              }
            : null,

        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
      };

      const permCtx = { role: currentRole, userId: user?.id };
      const authOpts = { ctx: permCtx, actorRole: currentRole, actorId: user?.id };

      if (isNew) {
        const inserted = await createProjectItem(payload, authOpts);

        if (selectedTestimonialId) {
          await (supabase as any)
            .from("testimonials")
            .update({ project_id: inserted.id })
            .eq("id", selectedTestimonialId);
        }

        toast.success(nextPublished ? "Case study published successfully!" : "Draft saved successfully!");
        nav({ to: "/admin/projects/$id", params: { id: inserted.id } });
      } else {
        await updateProjectItem(id, payload, authOpts);

        if (selectedTestimonialId) {
          await (supabase as any)
            .from("testimonials")
            .update({ project_id: id })
            .eq("id", selectedTestimonialId);
        }

        setPublished(nextPublished);
        toast.success(nextPublished ? "Case study published successfully!" : "Changes saved to draft!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  // Delete project
  const handleDelete = async () => {
    if (!canDelete || isNew) return;
    setDeleting(true);
    try {
      const permCtx = { role: currentRole, userId: user?.id };
      await deleteProjectItem(id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Case study deleted");
      nav({ to: "/admin/projects" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete case study");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center text-muted-foreground text-sm">Loading editor...</div>
      </div>
    );
  }

  const previewSlug = slug || slugify(title) || "preview";
  const previewUrl = `/case-studies/${previewSlug}?preview=true`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 00 — TOP COMMAND BAR (Sticky) */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/admin/projects"
              className="p-2 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Back to Case Studies"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg truncate">{title.trim() ? title : "New Case Study"}</h1>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    published
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${published ? "bg-green-500" : "bg-amber-500"}`} />
                  {published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                /case-studies/{slug || "slug-pending"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Preview Button */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5"
            >
              <Eye className="size-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </a>

            {/* Save Draft */}
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl border border-border/90 bg-muted/40 hover:bg-muted text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>{saving ? "Saving..." : "Save Draft"}</span>
            </button>

            {/* Publish / Unpublish */}
            {published ? (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-xl border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="size-3.5" />
                <span>Publish</span>
              </button>
            )}

            {/* Delete button (Super Admin only) */}
            {canDelete && !isNew && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete Case Study"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE SECTION TABS (< 768px) */}
      <div className="md:hidden border-b border-border bg-card/50 overflow-x-auto px-4 py-2 flex items-center gap-1">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => setActiveSection(sec.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === sec.id
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* WORKSPACE BODY (Two columns on desktop) */}
      <div className="flex-1 max-w-7xl mx-auto w-full grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-6 p-4 sm:p-6">
        {/* SIDEBAR NAVIGATION (Desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-20 rounded-2xl border border-border/80 bg-card/60 p-3 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Content Sections
            </div>
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isCurrent = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(sec.id);
                    const el = document.getElementById(sec.id);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4" />
                    <span>{sec.label}</span>
                  </div>
                  {isCurrent && <ChevronRight className="size-3.5" />}
                </button>
              );
            })}

            {/* Quick Publish Readiness box */}
            <div className="mt-4 pt-4 border-t border-border/60 px-3 pb-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-muted-foreground">Publish Readiness</span>
                <span className={checklist.allPassed ? "text-green-600 font-bold" : "text-amber-600"}>
                  {checklist.checks.filter((c) => c.passed).length}/{checklist.checks.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${checklist.allPassed ? "bg-green-500" : "bg-amber-500"}`}
                  style={{
                    width: `${(checklist.checks.filter((c) => c.passed).length / checklist.checks.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT WORKSPACE */}
        <main className="space-y-10 pb-20 min-w-0">
          {/* SECTION 01 — OVERVIEW */}
          <section id="overview" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <FileText className="size-4" /> Section 01
              </div>
              <h2 className="text-xl font-bold font-display">Project Overview & Identity</h2>
              <p className="text-xs text-muted-foreground">
                Core identity, title, slug, and high-level client description.
              </p>
            </div>

            <div className="space-y-4">
              {/* Project Title (EN & AR) */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Project Title (English) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Janat Sahara Brand & Digital Platform"
                    className="w-full text-base sm:text-lg font-semibold px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Project Title (العنوان بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="مثال: منصة وهُوِيّة جنّة الصحراء الرقمية"
                    className="w-full text-base sm:text-lg font-semibold px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* Slug */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Public Slug <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Auto-generated from title, editable
                  </span>
                </div>
                <div className="flex items-center rounded-xl border border-border bg-muted/20 px-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                  <span className="text-xs font-mono text-muted-foreground/70 select-none">
                    /case-studies/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value));
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="janat-sahara-travel-website"
                    className="flex-1 text-sm font-mono py-2.5 px-1 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Client & Industry Grid (EN & AR) */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Client Name (English)
                  </label>
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="e.g. Janat Sahara"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Client Name (اسم العميل بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={clientAr}
                    onChange={(e) => setClientAr(e.target.value)}
                    placeholder="مثال: جنة الصحراء"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Industry (English)
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Travel & Tourism"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Industry (القطاع بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={industryAr}
                    onChange={(e) => setIndustryAr(e.target.value)}
                    placeholder="مثال: السياحة والضيافة الفاخرة"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* Filter Category & Date */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Filter Category (English)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Marketing · Development · Production"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Filter Category (التصنيف بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={categoryAr}
                    onChange={(e) => setCategoryAr(e.target.value)}
                    placeholder="تسويق · تطوير · إنتاج مرئي"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Project Date (Year)
                  </label>
                  <SADADatePicker
                    value={projectDate}
                    onChange={setProjectDate}
                    placeholder="Pick project date"
                  />
                </div>
              </div>

              {/* Overview Description (EN & AR) */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Short Description (English) <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain the client context, what problem SADA was engaged to solve, and the overarching goal..."
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Short Description (الموجز التنفيذي بالعربية)
                  </label>
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    placeholder="اشرح سياق العميل، والمشكلة التي تم استدعاء صدى لحلها، والهدف الشامل باللغة العربية..."
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* Featured Switch & Sort Order */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/50">
                <SADASwitch
                  checked={featured}
                  onCheckedChange={setFeatured}
                  label="Feature on SADA Homepage"
                  description="Display project inside the Homepage 'Featured Work' showcase."
                />

                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground font-medium">Sort Order:</label>
                  <SADACounter
                    value={sortOrder}
                    onChange={setSortOrder}
                    min={0}
                    max={999}
                    size="compact"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 02 — PROJECT STORY */}
          <section id="story" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <Target className="size-4" /> Section 02
              </div>
              <h2 className="text-xl font-bold font-display">The Case Study Story</h2>
              <p className="text-xs text-muted-foreground">
                The strategic narrative: what was the challenge, what was the objective, and what did SADA do?
              </p>
            </div>

            <div className="space-y-5">
              {/* The Challenge */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Target className="size-3.5 text-primary" /> The Challenge (English)
                  </label>
                  <textarea
                    rows={4}
                    value={challenge}
                    onChange={(e) => setChallenge(e.target.value)}
                    placeholder="What was the business problem or bottleneck the client was facing before working with SADA?"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Target className="size-3.5 text-primary" /> The Challenge (التحدي بالعربية)
                  </label>
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={challengeAr}
                    onChange={(e) => setChallengeAr(e.target.value)}
                    placeholder="ما المشكلة التجارية أو التحدي الذي واجهه العميل قبل التعاون مع صدى؟"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* The Objective */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Flag className="size-3.5 text-primary" /> The Objective (English)
                  </label>
                  <textarea
                    rows={3}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="What specific outcome or repositioning did the client need to achieve?"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Flag className="size-3.5 text-primary" /> The Objective (الهدف الاستراتيجي بالعربية)
                  </label>
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={objectiveAr}
                    onChange={(e) => setObjectiveAr(e.target.value)}
                    placeholder="ما النتيجة المحددة أو إعادة التموضع التي تطلع العميل لتحقيقها؟"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* The Strategy */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Lightbulb className="size-3.5 text-primary" /> The Strategy (English)
                  </label>
                  <textarea
                    rows={4}
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    placeholder="How did SADA approach solving this? What strategic decisions did we make?"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Lightbulb className="size-3.5 text-primary" /> The Strategy (الاستراتيجية بالعربية)
                  </label>
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={strategyAr}
                    onChange={(e) => setStrategyAr(e.target.value)}
                    placeholder="كيف صاغت صدى الحل؟ وما القرارات الاستراتيجية التي تم اتخاذها؟"
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>

              {/* The Process */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Layers className="size-3.5 text-primary" /> What SADA Did (English Narrative)
                  </label>
                  <textarea
                    rows={3}
                    value={process}
                    onChange={(e) => setProcess(e.target.value)}
                    placeholder="Optional introductory narrative shown before the services breakdown..."
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Layers className="size-3.5 text-primary" /> What SADA Did (السرد التنفيذي بالعربية)
                  </label>
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={processAr}
                    onChange={(e) => setProcessAr(e.target.value)}
                    placeholder="سرد تمهيدي اختياري يظهر قبل تفصيل الخدمات باللغة العربية..."
                    className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 03 — SERVICES & DELIVERABLES */}
          <section id="services" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <Layers className="size-4" /> Section 03
              </div>
              <h2 className="text-xl font-bold font-display">Services & Deliverables</h2>
              <p className="text-xs text-muted-foreground">
                Select from canonical SADA divisions and specify tangible outputs.
              </p>
            </div>

            {/* Canonical SADA Service Taxonomy */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SADA Core Services Taxonomy
              </label>

              <div className="grid gap-4">
                {DIVISIONS.map((div) => {
                  const Icon = div.icon;
                  return (
                    <div key={div.id} className="rounded-2xl border border-border/70 bg-background/50 p-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <Icon className="size-3.5 text-primary" />
                        <span>{div.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {div.services.map((svc) => {
                          const isSelected = selectedServices.includes(svc);
                          return (
                            <button
                              key={svc}
                              type="button"
                              onClick={() => handleToggleService(svc)}
                              className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                              }`}
                            >
                              {isSelected ? "✓ " : "+ "}
                              {svc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Service Tag Input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={customServiceInput}
                  onChange={(e) => setCustomServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomService();
                    }
                  }}
                  placeholder="Add custom specialized service..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={handleAddCustomService}
                  className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Deliverables List */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tangible Deliverables
              </label>

              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {deliverables.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl bg-muted text-foreground border border-border/60"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(item)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDeliverableInput}
                  onChange={(e) => setNewDeliverableInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDeliverable();
                    }
                  }}
                  placeholder="e.g. Brand Guidelines, Custom React Web Application, 12 Ad Creatives"
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={handleAddDeliverable}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                >
                  Add Deliverable
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 04 — RESULTS & PROOF */}
          <section id="results" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <CheckCircle2 className="size-4" /> Section 04
              </div>
              <h2 className="text-xl font-bold font-display">Results & Documented Proof</h2>
              <p className="text-xs text-muted-foreground">
                Real documented outcomes, verifiable performance metrics, and public proof links.
              </p>
            </div>

            {/* Qualitative Results (EN & AR) */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Qualitative Results (English)
                </label>
                <textarea
                  rows={3}
                  value={resultsText}
                  onChange={(e) => setResultsText(e.target.value)}
                  placeholder="Describe what changed for the client after launch (e.g. inquiries increased, brand equity improved, conversions doubled)..."
                  className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Qualitative Results (النتائج النوعية بالعربية)
                </label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={resultsAr}
                  onChange={(e) => setResultsAr(e.target.value)}
                  placeholder="صِف ما تغير لدى العميل بعد الإطلاق باللغة العربية (مثل تضاعف الاستفسارات، ترسيخ مكانة العلامة، نمو التحويلات)..."
                  className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-end"
                />
              </div>
            </div>

            {/* Key Metrics Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Verifiable Metrics (Numbers & KPIs)
                  </label>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Important: Only use verified numbers. Never invent fake agency metrics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMetric}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted font-semibold"
                >
                  <Plus className="size-3" /> Add Metric
                </button>
              </div>

              {metrics.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                  No quantitative metrics added. Qualitative results above will be displayed.
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-border bg-background grid sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={m.value}
                        onChange={(e) => handleUpdateMetric(idx, "value", e.target.value)}
                        placeholder="e.g. +140%"
                        className="text-xs p-2 rounded-lg border border-border font-bold text-primary"
                      />
                      <input
                        type="text"
                        value={m.label}
                        onChange={(e) => handleUpdateMetric(idx, "label", e.target.value)}
                        placeholder="Label (e.g. Organic Inquiries)"
                        className="text-xs p-2 rounded-lg border border-border"
                      />
                      <input
                        type="text"
                        value={m.period || ""}
                        onChange={(e) => handleUpdateMetric(idx, "period", e.target.value)}
                        placeholder="Period (e.g. 3 months)"
                        className="text-xs p-2 rounded-lg border border-border"
                      />
                      <input
                        type="text"
                        value={m.source || ""}
                        onChange={(e) => handleUpdateMetric(idx, "source", e.target.value)}
                        placeholder="Source (e.g. Meta Ads)"
                        className="text-xs p-2 rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMetric(idx)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* External Live Proof Link */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <ExternalLink className="size-3.5" /> External Proof / Live Website Link
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://janatsahara.com"
                className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </section>

          {/* SECTION 05 — MEDIA & VISUALS */}
          <section id="media" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <ImageIcon className="size-4" /> Section 05
              </div>
              <h2 className="text-xl font-bold font-display">Media & Visual Assets</h2>
              <p className="text-xs text-muted-foreground">
                Thumbnail cover, hero visual, and multi-asset gallery for this case study.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Thumbnail */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Portfolio Card Thumbnail <span className="text-destructive">*</span>
                </label>
                <MediaUpload
                  value={thumbnailUrl}
                  onChange={setThumbnailUrl}
                  folder="projects"
                  label="Upload card thumbnail"
                  aspect="aspect-[16/10]"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Used on public portfolio grid and cards (16:10 aspect ratio).
                </p>
              </div>

              {/* Cover Hero */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Hero Cover (Case Study Detail Page)
                </label>
                <MediaUpload
                  value={coverUrl}
                  onChange={setCoverUrl}
                  folder="projects"
                  label="Upload hero banner"
                  aspect="aspect-video"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Large header visual shown at the top of the case study detail page.
                </p>
              </div>
            </div>

            {/* Gallery */}
            <div className="pt-4 border-t border-border/60 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Project Gallery (Images & Videos)
              </label>
              <MediaUploadMulti
                value={gallery}
                onChange={setGallery}
                folder="projects"
                label="Add gallery images or video"
              />
              <p className="text-[11px] text-muted-foreground">
                Drag and drop or click to add multiple files. Supports JPG, PNG, WebP, MP4 up to 50MB.
              </p>
            </div>

            {/* Optional Before / After */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Optional Before / After Visuals
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">Before Visual</div>
                  <MediaUpload
                    value={beforeUrl}
                    onChange={setBeforeUrl}
                    folder="projects"
                    label="Upload before"
                    aspect="aspect-[4/3]"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">After Visual</div>
                  <MediaUpload
                    value={afterUrl}
                    onChange={setAfterUrl}
                    folder="projects"
                    label="Upload after"
                    aspect="aspect-[4/3]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 06 — TEAM MEMBERS */}
          <section id="team" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <Users className="size-4" /> Section 06
              </div>
              <h2 className="text-xl font-bold font-display">The Team Behind The Work</h2>
              <p className="text-xs text-muted-foreground">
                Select SADA team members who contributed to this project. Only active, public-safe profiles are shown.
              </p>
            </div>

            {availableTeam.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                No active team members found in system.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availableTeam.map((m) => {
                  const isSelected = selectedTeamMemberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleTeamMember(m.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                          : "border-border bg-card/50 hover:bg-muted/60"
                      }`}
                    >
                      {m.photo_url ? (
                        <img
                          src={m.photo_url}
                          alt={m.name}
                          className="size-10 rounded-full object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="size-10 rounded-full bg-primary/10 text-primary font-bold grid place-items-center shrink-0 text-sm">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate flex items-center justify-between">
                          <span>{m.name}</span>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </div>
                        {m.position && (
                          <div className="text-[11px] text-muted-foreground truncate">{m.position}</div>
                        )}
                        {m.division && (
                          <div className="text-[10px] uppercase font-bold text-primary/80 mt-0.5">
                            {m.division}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 07 — CLIENT TESTIMONIAL */}
          <section id="testimonial" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <Quote className="size-4" /> Section 07
              </div>
              <h2 className="text-xl font-bold font-display">Client Testimonial</h2>
              <p className="text-xs text-muted-foreground">
                Attach a real, verified quote from the client. Never create placeholder testimonials.
              </p>
            </div>

            {/* Existing Testimonial Quick Picker */}
            {availableTestimonials.length > 0 && (
              <div className="p-3.5 rounded-xl border border-border bg-background/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Link from Testimonials Database (Canonical Reference)</span>
                  <span className="text-[11px] text-muted-foreground">{availableTestimonials.length} available</span>
                </div>
                <SADACombobox
                  value={selectedTestimonialId}
                  onChange={(val) => {
                    handleSelectExistingTestimonial(val);
                  }}
                  clearable
                  placeholder="Select existing verified testimonial..."
                  searchPlaceholder="Search testimonials..."
                  options={availableTestimonials.map((t) => ({
                    value: t.id,
                    label: `${t.client_name}${t.company ? ` (${t.company})` : ""}`,
                    subtitle: `"${t.review.slice(0, 50)}..."`,
                  }))}
                />
                {selectedTestimonialId && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-1">
                    <Check className="size-3.5" />
                    <span>Canonical reference linked via database relationship (`testimonials.project_id`). No duplicated data.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Client Quote
                </label>
                <textarea
                  rows={3}
                  value={testimonialQuote}
                  onChange={(e) => setTestimonialQuote(e.target.value)}
                  placeholder='"Working with SADA completely transformed our brand position and increased inquiries..."'
                  className="w-full text-sm leading-relaxed p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Client Name / Representative
                  </label>
                  <input
                    type="text"
                    value={testimonialName}
                    onChange={(e) => setTestimonialName(e.target.value)}
                    placeholder="e.g. Sarah Mansour"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Client Role / Organization
                  </label>
                  <input
                    type="text"
                    value={testimonialRole}
                    onChange={(e) => setTestimonialRole(e.target.value)}
                    placeholder="e.g. Managing Director, Janat Sahara"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 08 — SEO & METADATA */}
          <section id="seo" className="rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-7 space-y-6">
            <div className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
                <Search className="size-4" /> Section 08
              </div>
              <h2 className="text-xl font-bold font-display">SEO & Search Snippet</h2>
              <p className="text-xs text-muted-foreground">
                Search engine optimization tags and live preview of Google SERP representation.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Custom SEO Title
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={client ? `${title} — ${client} | SADA` : `${title || "Case Study"} | SADA`}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Custom Meta Description
                </label>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder={description || "A case study by SADA detailing branding, development and production."}
                  className="w-full text-sm p-3.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* SERP PREVIEW BOX */}
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Google Search Snippet Preview
                </div>
                <div className="text-xs text-green-700 dark:text-green-500 font-mono">
                  https://sada.tn/case-studies/{slug || "example-project"}
                </div>
                <div className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  {seoTitle || (client ? `${title || "Project Title"} — ${client} | SADA` : `${title || "Project Title"} | SADA`)}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {seoDescription || description || "A comprehensive case study by SADA creative studio."}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* PUBLISH VALIDATION CHECKLIST MODAL */}
      <Dialog open={showPublishChecklist} onOpenChange={setShowPublishChecklist}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Cannot Publish Yet
            </DialogTitle>
            <DialogDescription>
              Please fulfill the minimum case study requirements before publishing publicly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-3">
            {checklist.checks.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  c.passed
                    ? "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400"
                    : "bg-destructive/5 border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex items-center gap-2">
                  {c.passed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                  ) : (
                    <X className="size-4 shrink-0 text-destructive" />
                  )}
                  <span className="font-medium">{c.label}</span>
                </div>
                <span className="text-[10px] uppercase font-bold">
                  {c.passed ? "Ready" : "Missing"}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowPublishChecklist(false)}
              className="w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
            >
              Back to Editor to Fix
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE MODAL */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently Delete Case Study?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>"{title}"</strong>? This will remove all project content and public pages.
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
              {deleting ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
