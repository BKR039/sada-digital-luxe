import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";
import {
  createSocialReel,
  updateSocialReel,
  publishSocialReel,
  setFeaturedSocialReel,
  reorderSocialReels,
  deleteSocialReel,
  parseInstagramReelUrl,
} from "@/lib/content-service";
import { toast } from "sonner";
import {
  Film,
  Plus,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Instagram,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Star,
  Check,
  ImageIcon,
} from "lucide-react";
import { MediaUpload } from "@/components/media/MediaUpload";
import { SmartMedia } from "@/components/media/SmartMedia";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  SADAInput,
  SADATextarea,
  SADACounter,
  SADASwitch,
  SkeletonTable,
} from "@/components/ui/sada-ui";
import type { Tables } from "@/integrations/supabase/types";

type SocialReel = Tables<"social_reels">;

export const Route = createFileRoute("/admin/reels")({
  component: AdminReelsPage,
});

function AdminReelsPage() {
  const { user, role, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [reels, setReels] = useState<SocialReel[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modal State (Add or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReel, setEditingReel] = useState<SocialReel | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formUrl, setFormUrl] = useState("");
  const [formThumbnail, setFormThumbnail] = useState<string | null>("");
  const [formTitle, setFormTitle] = useState("");
  const [formTitleAr, setFormTitleAr] = useState("");
  const [formCategory, setFormCategory] = useState("Creative Strategy");
  const [formCaption, setFormCaption] = useState("");
  const [formDescriptionAr, setFormDescriptionAr] = useState("");
  const [formOrder, setFormOrder] = useState(1);
  const [formPublished, setFormPublished] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);

  // Delete Alert State
  const [deletingReel, setDeletingReel] = useState<SocialReel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load reels
  const loadReels = async (forceLoading = false) => {
    if (forceLoading || reels.length === 0) {
      setLoading(true);
    }
    const { data, error } = await supabase
      .from("social_reels")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true });

    if (error) {
      toast.error(`Failed to load reels: ${error.message}`);
    } else {
      setReels(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Unauthorized: Admin access required.");
      navigate({ to: "/admin" });
      return;
    }
    if (isAdmin) {
      loadReels();
    }
  }, [authLoading, isAdmin, navigate]);

  // Real-time URL validation
  const urlValidation = useMemo(() => {
    if (!formUrl.trim()) return { touched: false, isValid: false, shortcode: null, canonicalUrl: null };
    const res = parseInstagramReelUrl(formUrl);
    return { touched: true, isValid: res.isValid, shortcode: res.shortcode, canonicalUrl: res.canonicalUrl };
  }, [formUrl]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingReel(null);
    setFormUrl("");
    setFormThumbnail("");
    setFormTitle("");
    setFormTitleAr("");
    setFormCategory("Creative Strategy");
    setFormCaption("");
    setFormDescriptionAr("");
    setFormOrder(reels.length > 0 ? Math.max(...reels.map((r) => r.display_order)) + 1 : 1);
    setFormPublished(true);
    setFormFeatured(reels.length === 0);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (reel: SocialReel) => {
    setEditingReel(reel);
    setFormUrl(reel.instagram_url);
    setFormThumbnail(reel.thumbnail_url);
    setFormTitle(reel.title);
    setFormTitleAr(reel.title_ar || "");
    setFormCategory(reel.category || "General");
    setFormCaption(reel.caption || "");
    setFormDescriptionAr(reel.description_ar || "");
    setFormOrder(reel.display_order);
    setFormPublished(reel.is_published);
    setFormFeatured(reel.is_featured);
    setIsModalOpen(true);
  };

  // Save Reel (Insert or Update via Content CMS Service)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      toast.error("Please enter a title for the Reel.");
      return;
    }

    if (!urlValidation.isValid || !urlValidation.shortcode || !urlValidation.canonicalUrl) {
      toast.error("Please provide a valid Instagram Reel URL (e.g., https://www.instagram.com/reel/C1234567890/).");
      return;
    }

    if (!formThumbnail) {
      toast.error("Please upload a 9:16 thumbnail for the Reel.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        title_ar: formTitleAr.trim() || null,
        category: formCategory.trim() || "General",
        caption: formCaption.trim() || null,
        description_ar: formDescriptionAr.trim() || null,
        instagram_url: urlValidation.canonicalUrl,
        instagram_shortcode: urlValidation.shortcode,
        thumbnail_url: formThumbnail,
        display_order: Number(formOrder) || 1,
        is_published: formPublished,
        is_featured: formFeatured,
      };

      const permCtx = { role: normalizeRole(role), userId: user?.id };
      const authOpts = { ctx: permCtx, actorRole: role || undefined, actorId: user?.id };

      if (editingReel) {
        await updateSocialReel(editingReel.id, payload, authOpts);
        toast.success("Reel updated successfully");
      } else {
        await createSocialReel(payload, authOpts);
        toast.success("Reel created successfully");
      }

      setIsModalOpen(false);
      await loadReels();
    } catch (err: any) {
      toast.error(`Save error: ${err.message || "Operation failed"}`);
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Published via Content CMS Service
  const handleTogglePublished = async (reel: SocialReel) => {
    const permCtx = { role: normalizeRole(role), userId: user?.id };
    const nextState = !reel.is_published;
    try {
      await publishSocialReel(reel.id, nextState, {
        ctx: permCtx,
        actorRole: role || undefined,
        actorId: user?.id,
      });
      toast.success(nextState ? `Published: ${reel.title}` : `Unpublished: ${reel.title}`);
      await loadReels();
    } catch (err: any) {
      toast.error(`Error: ${err.message || "Failed to update publication status"}`);
    }
  };

  // Quick Toggle Featured (Enforces single featured reel via service & DB trigger)
  const handleToggleFeatured = async (reel: SocialReel) => {
    const permCtx = { role: normalizeRole(role), userId: user?.id };
    const nextState = !reel.is_featured;
    try {
      await setFeaturedSocialReel(reel.id, nextState, {
        ctx: permCtx,
        actorRole: role || undefined,
        actorId: user?.id,
      });
      toast.success(
        nextState
          ? `Set "${reel.title}" as Primary Featured Reel`
          : `Removed featured status from "${reel.title}"`,
      );
      await loadReels();
    } catch (err: any) {
      toast.error(`Error: ${err.message || "Failed to update featured reel"}`);
    }
  };

  // Reorder Move Up / Move Down via Content CMS Service
  const handleMoveOrder = async (reel: SocialReel, direction: "up" | "down") => {
    const sorted = [...reels].sort((a, b) => a.display_order - b.display_order);
    const currentIndex = sorted.findIndex((r) => r.id === reel.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const neighbor = sorted[targetIndex];
    const originalCurrentOrder = reel.display_order;
    const originalNeighborOrder = neighbor.display_order;

    // Swap order values (ensuring distinct order)
    const newCurrentOrder = originalNeighborOrder;
    const newNeighborOrder =
      originalCurrentOrder === originalNeighborOrder
        ? direction === "up"
          ? originalCurrentOrder + 1
          : originalCurrentOrder - 1
        : originalCurrentOrder;

    try {
      const permCtx = { role: normalizeRole(role), userId: user?.id };
      await reorderSocialReels(
        [
          { id: reel.id, display_order: newCurrentOrder },
          { id: neighbor.id, display_order: newNeighborOrder },
        ],
        { ctx: permCtx, actorRole: role || undefined, actorId: user?.id }
      );
      toast.success("Order updated");
      await loadReels();
    } catch (err: any) {
      toast.error(`Failed to update order: ${err.message || "Error"}`);
    }
  };

  // Delete Reel (Super Admin Only) via Content CMS Service
  const handleDelete = async () => {
    if (!deletingReel) return;
    if (!isSuperAdmin) {
      toast.error("Permission Denied: Permanent deletion is restricted to Super Admins.");
      setDeletingReel(null);
      return;
    }

    setIsDeleting(true);
    try {
      const permCtx = { role: normalizeRole(role), userId: user?.id };
      await deleteSocialReel(deletingReel.id, {
        ctx: permCtx,
        actorRole: role || undefined,
        actorId: user?.id,
      });
      toast.success(`Deleted: ${deletingReel.title}`);
      setDeletingReel(null);
      await loadReels();
    } catch (err: any) {
      toast.error(`Delete error: ${err.message || "Deletion failed"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase mb-1">
            <Film className="size-4" />
            <span>Website CMS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Instagram Reels Showcase
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate and reorder the real Instagram Reels displayed in the homepage preview section.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all self-start sm:self-auto"
        >
          <Plus className="size-4" />
          <span>Add Reel</span>
        </button>
      </div>

      {/* Rules & Architecture Notice */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 text-xs sm:text-sm text-muted-foreground">
        <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">SADA Content Architecture Rules:</p>
          <p>
            Videos are served directly from Instagram. SADA stores metadata and high-res thumbnails only.
            At most <strong>one Reel</strong> can be marked as <span className="text-cyan-500 font-semibold">Featured / Primary</span> (leads the homepage).
          </p>
        </div>
      </div>

      {/* Reels List / Table */}
      {(loading && reels.length === 0) ? (
        <SkeletonTable rows={5} cols={5} />
      ) : reels.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-dashed border-border bg-card p-8">
          <Film className="size-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">Your Reel showcase is empty</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
            Add your latest Instagram content to start building your public showcase.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-xs sm:text-sm font-semibold hover:opacity-90 shadow-md transition-all"
          >
            <Plus className="size-4" />
            <span>Add Reel</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {reels.map((reel, index) => {
            const formattedOrder = String(reel.display_order).padStart(2, "0");
            return (
              <div
                key={reel.id}
                className={`rounded-2xl border transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  reel.is_featured
                    ? "bg-cyan-500/[0.04] border-cyan-500/40 shadow-sm"
                    : "bg-card border-border hover:border-border/80 shadow-xs"
                }`}
              >
                {/* Left Column: Thumbnail + Info */}
                <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                  {/* True 9:16 Vertical Thumbnail Preview */}
                  <div className="relative w-16 h-28 sm:w-20 sm:h-36 rounded-2xl overflow-hidden bg-black/80 border border-white/10 shrink-0 shadow-md">
                    <SmartMedia
                      src={reel.thumbnail_url}
                      alt={reel.title}
                      fit="cover"
                      className="w-full h-full object-center"
                      loading="lazy"
                      autoplay={false}
                    />
                    {reel.is_featured ? (
                      <div
                        title="Primary Featured Reel"
                        className="absolute top-1.5 left-1.5 size-6 rounded-full bg-cyan-400 text-slate-950 grid place-items-center shadow-md ring-2 ring-black/40"
                      >
                        <Star className="size-3.5 fill-current" />
                      </div>
                    ) : (
                      <div className="absolute top-1.5 left-1.5 size-5 rounded-full bg-black/60 text-white/80 grid place-items-center backdrop-blur-xs">
                        <Instagram className="size-2.5 text-cyan-400" />
                      </div>
                    )}
                  </div>

                  {/* Metadata & Details (Fast visual hierarchy) */}
                  <div className="min-w-0 space-y-1.5 flex-1">
                    {/* Top Row: Order, Category, Status Pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-muted text-foreground border border-border">
                        #{formattedOrder}
                      </span>

                      {reel.category && (
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {reel.category}
                        </span>
                      )}

                      {reel.is_featured && (
                        <span
                          title="This Reel is currently used as the primary homepage Reel."
                          className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-500 border border-cyan-500/40"
                        >
                          <Sparkles className="size-2.5" /> FEATURED / PRIMARY
                        </span>
                      )}

                      {reel.is_published ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                          <CheckCircle2 className="size-2.5" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/20">
                          <XCircle className="size-2.5" /> Draft
                        </span>
                      )}
                    </div>

                    {/* Title & Arabic Title */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {reel.title}
                      </h3>
                      {reel.title_ar && (
                        <span
                          dir="rtl"
                          className="text-xs sm:text-sm font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-muted/60 border border-border/60"
                        >
                          {reel.title_ar}
                        </span>
                      )}
                    </div>

                    {/* Source & Description */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <a
                        href={reel.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-mono hover:underline"
                      >
                        <Instagram className="size-3.5" />
                        <span>{reel.instagram_shortcode}</span>
                        <ExternalLink className="size-2.5 opacity-70" />
                      </a>
                      {reel.caption && (
                        <span className="hidden sm:inline truncate max-w-sm text-muted-foreground/75">
                          • {reel.caption}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Order & Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                  {/* Reorder Buttons */}
                  <div className="flex items-center border border-border rounded-xl bg-muted/40 p-0.5">
                    <button
                      type="button"
                      title="Move Up"
                      onClick={() => handleMoveOrder(reel, "up")}
                      disabled={index === 0}
                      className="size-8 grid place-items-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Move Down"
                      onClick={() => handleMoveOrder(reel, "down")}
                      disabled={index === reels.length - 1}
                      className="size-8 grid place-items-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>

                  {/* Quick Toggle Featured */}
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(reel)}
                    title={
                      reel.is_featured
                        ? "Currently Primary Featured Reel (Click to remove)"
                        : "Set as Primary Featured Reel"
                    }
                    className={`size-9 rounded-xl border grid place-items-center transition-all ${
                      reel.is_featured
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:text-cyan-500 hover:border-cyan-500/40"
                    }`}
                  >
                    <Star className="size-4 fill-current" />
                  </button>

                  {/* Quick Toggle Published */}
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(reel)}
                    title={reel.is_published ? "Unpublish Reel" : "Publish Reel"}
                    className={`size-9 rounded-xl border grid place-items-center transition-colors ${
                      reel.is_published
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    {reel.is_published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(reel)}
                    title="Edit Reel"
                    className="size-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center transition-colors"
                  >
                    <Pencil className="size-4" />
                  </button>

                  {/* Delete Button (Super Admin) */}
                  <button
                    type="button"
                    onClick={() => setDeletingReel(reel)}
                    title="Delete Reel"
                    className="size-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 grid place-items-center transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redesigned Add / Edit Modal (Structured 2-Column on Desktop) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Film className="size-5 text-primary" />
              <span>{editingReel ? "Edit Instagram Reel" : "Add New Instagram Reel"}</span>
            </DialogTitle>
            <DialogDescription>
              Configure the Reel displayed in the SADA homepage showcase. The actual video is hosted by Instagram.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 pt-2">
            <div className="grid md:grid-cols-2 gap-6 items-start">
              {/* LEFT COLUMN: Source & Preview/Upload */}
              <div className="space-y-5">
                {/* SECTION A — SOURCE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">SECTION A — SOURCE</span>
                    {urlValidation.touched && (
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          urlValidation.isValid ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {urlValidation.isValid
                          ? `✓ Valid Reel (${urlValidation.shortcode})`
                          : "Invalid Instagram URL"}
                      </span>
                    )}
                  </div>
                  <SADAInput
                    type="url"
                    required
                    label="Instagram Reel URL"
                    placeholder="https://www.instagram.com/reel/C7-X5zTsp9Q/"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    startIcon={<Instagram className="size-4 text-muted-foreground" />}
                    helperText="Accepts instagram.com/reel/[code] or instagram.com/p/[code]"
                  />
                </div>

                {/* SECTION B — PREVIEW & THUMBNAIL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">SECTION B — THUMBNAIL (9:16)</span>
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">
                      INSTAGRAM REEL
                    </span>
                  </div>
                  <div className="max-w-[220px] mx-auto">
                    <MediaUpload
                      value={formThumbnail}
                      onChange={setFormThumbnail}
                      folder="reels"
                      label="Upload 9:16 Thumbnail"
                      aspect="aspect-[9/16]"
                    />
                  </div>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Recommended 9:16 vertical image (max 50MB). Only thumbnails are stored; video remains on Instagram.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: Content & Display */}
              <div className="space-y-5">
                {/* SECTION C — CONTENT */}
                <div className="space-y-3.5">
                  <div className="text-xs font-bold text-foreground">SECTION C — CONTENT</div>

                  {/* Title (English) */}
                  <SADAInput
                    label="Title (English / Default)"
                    required
                    placeholder="e.g. From Concept to Conversion"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />

                  {/* Title (Arabic) */}
                  <SADAInput
                    label="Title (Arabic) — عنوان الريل"
                    dir="rtl"
                    placeholder="مثال: من الفكرة حتى المبيعات الرقمية"
                    value={formTitleAr}
                    onChange={(e) => setFormTitleAr(e.target.value)}
                  />

                  {/* Category */}
                  <SADAInput
                    label="Category"
                    placeholder="e.g. Creative Strategy"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  />

                  {/* Caption (English) */}
                  <SADATextarea
                    label="Caption / Note (English)"
                    rows={2}
                    placeholder="Short description or narrative note..."
                    value={formCaption}
                    onChange={(e) => setFormCaption(e.target.value)}
                  />

                  {/* Caption (Arabic) */}
                  <SADATextarea
                    label="Caption / Note (Arabic) — الوصف بالعربية"
                    dir="rtl"
                    rows={2}
                    placeholder="ملاحظة أو وصف موجز للريل باللغة العربية..."
                    value={formDescriptionAr}
                    onChange={(e) => setFormDescriptionAr(e.target.value)}
                  />
                </div>

                {/* SECTION D — DISPLAY SETTINGS */}
                <div className="space-y-3 pt-1 border-t border-border">
                  <div className="text-xs font-bold text-foreground">SECTION D — DISPLAY</div>

                  {/* Display Order */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Display Order</label>
                    <SADACounter
                      min={1}
                      value={formOrder}
                      onChange={setFormOrder}
                      className="w-full"
                    />
                  </div>

                  {/* Published & Featured Toggles */}
                  <div className="space-y-2.5 pt-1">
                    <div className="p-3 rounded-xl border border-border bg-muted/30">
                      <SADASwitch
                        checked={formPublished}
                        onCheckedChange={setFormPublished}
                        label="Published"
                        description="Visible on SADA homepage"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                      <SADASwitch
                        checked={formFeatured}
                        onCheckedChange={setFormFeatured}
                        label={
                          <span className="flex items-center gap-1.5 text-foreground">
                            <Sparkles className="size-3.5 text-cyan-500" /> Featured / Primary Reel
                          </span>
                        }
                        description="Use this Reel as the primary homepage highlight."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <DialogFooter className="pt-4 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-6 -mb-6 px-6 py-4 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                <span>{editingReel ? "Update Reel" : "Save Reel"}</span>
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingReel} onOpenChange={(open) => !open && setDeletingReel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="size-5" />
              <span>Delete Instagram Reel?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                Are you sure you want to delete <strong>&quot;{deletingReel?.title}&quot;</strong> from the SADA website CMS?
              </p>
              <p className="text-xs text-muted-foreground">
                This action only deletes the SADA CMS record and thumbnail. It does <strong>not</strong> delete or modify the Reel on Instagram.
              </p>
              {!isSuperAdmin && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                  Warning: Deletion requires Super Admin permissions.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || !isSuperAdmin}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
