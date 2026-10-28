import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Trash2,
  Mail,
  ArrowRight,
  CheckCircle2,
  Compass,
  Zap,
  MessageSquareText,
  Search,
  MessageCircle,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Target,
  Sparkles,
  Layers,
  Phone,
  ShieldAlert,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ConvertToProjectModal } from "@/components/admin/ConvertToProjectModal";
import { getIndustryContextLabel } from "@/components/discovery/discovery-utils";
import { SADAConfirmDialog } from "@/components/ui/sada-confirm-dialog";
import { SkeletonList, SkeletonMetric, Skeleton } from "@/components/ui/sada-ui";
import {
  computeInquiryStats,
  filterInquiries,
  deleteInquiry,
} from "@/lib/inquiry-service";

export const Route = createFileRoute("/admin/contact")({ component: InquiriesPage });

function InquiriesPage() {
  const { user, isSuperAdmin, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "converted">("all");
  const [pathFilter, setPathFilter] = useState<
    "all" | "smart_match" | "quick_match" | "direct_package" | "guided"
  >("all");
  const [converting, setConverting] = useState<any | null>(null);

  const load = async () => {
    if (!isSuperAdmin && !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [isSuperAdmin, isAdmin]);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const targetInq = rows.find((r) => r.id === deleteTargetId);
    if (targetInq?.converted_project_id) {
      setDeleting(false);
      toast.error(
        "Cannot delete inquiry: This inquiry is linked to an active converted project and must be preserved for audit history."
      );
      setDeleteTargetId(null);
      return;
    }

    const res = await deleteInquiry({
      inquiryId: deleteTargetId,
      actorId: user?.id,
      actorRole: isSuperAdmin ? "super_admin" : "admin",
    });
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error || "Failed to delete inquiry");
    } else {
      toast.success(res.message || "Inquiry deleted");
      setDeleteTargetId(null);
      load();
    }
  };

  const filtered = useMemo(() => {
    return filterInquiries(rows, { search, statusFilter, pathFilter });
  }, [rows, search, statusFilter, pathFilter]);

  const stats = useMemo(() => {
    return computeInquiryStats(rows);
  }, [rows]);

  if (authLoading || (loading && rows.length === 0)) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-60 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonMetric key={i} className="min-h-[110px]" hasIcon={false} hasSubtext={false} />
          ))}
        </div>
        <SkeletonList items={4} />
      </div>
    );
  }

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-3xl bg-card border border-rose-500/30 text-center shadow-2xl animate-in fade-in">
        <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 grid place-items-center mx-auto mb-4 border border-rose-500/20">
          <ShieldAlert className="size-7" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">
          Restricted Inquiries Portal
        </h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Client discovery submissions, contact leads, and project briefs are restricted to Administrators and Sales Leads.
        </p>
        <div className="mt-6">
          <button
            onClick={() => navigate({ to: "/admin/my-work" })}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            Return to My Work
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Client Inquiries & Discovery Briefs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Structured briefs submitted via the Smart Project Discovery flow.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Inquiries</div>
          <div className="font-display text-2xl font-bold mt-1 text-foreground">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending / New</div>
          <div className="font-display text-2xl font-bold mt-1 text-amber-500">{stats.pending}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Converted</div>
          <div className="font-display text-2xl font-bold mt-1 text-emerald-500">{stats.converted}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Direct Packages</div>
          <div className="font-display text-2xl font-bold mt-1 text-purple-500">{stats.packages}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Guided Discovery</div>
          <div className="font-display text-2xl font-bold mt-1 text-primary">{stats.guided}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client, business, service, keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm focus:border-primary outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-medium">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === "all" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({rows.length})
            </button>
            <button
              onClick={() => setStatusFilter("new")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === "new" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter("converted")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === "converted" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Converted ({stats.converted})
            </button>
          </div>

          {/* Path filter */}
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-medium flex-wrap gap-1">
            <button
              onClick={() => setPathFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathFilter === "all" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Paths ({stats.total})
            </button>
            <button
              onClick={() => setPathFilter("smart_match")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathFilter === "smart_match" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Smart Match ({stats.smartMatches})
            </button>
            <button
              onClick={() => setPathFilter("quick_match")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathFilter === "quick_match" ? "bg-amber-500/20 text-amber-600 font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Quick Match ({stats.quickMatches})
            </button>
            <button
              onClick={() => setPathFilter("direct_package")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathFilter === "direct_package" ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Packages ({stats.packages})
            </button>
            <button
              onClick={() => setPathFilter("guided")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathFilter === "guided" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Legacy Guided ({stats.guided})
            </button>
          </div>
        </div>
      </div>

      {/* List of Submissions */}
      <div className="space-y-4">
        {loading ? (
          <SkeletonList items={3} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            No inquiries match the current filter.
          </div>
        ) : (
          filtered.map((r) => {
            const d = r.discovery_data || null;
            const isPackage =
              r.path_taken === "package" ||
              d?.path_taken === "package" ||
              Boolean(d?.package_id);
            const path = isPackage ? "package" : (r.path_taken || (d?.path_taken ?? "guided"));

            return (
              <div
                key={r.id}
                className="rounded-2xl border border-border bg-card p-5 sm:p-6 elevated-shadow transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-display text-lg font-bold text-foreground">{r.name}</span>
                      {r.business_name && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary text-foreground">
                          <Building2 className="size-3 text-muted-foreground" />
                          {r.business_name}
                        </span>
                      )}
                      {/* Path badge */}
                      {d?.source ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            d.source === "smart_match"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : d.source === "quick_match"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {d.source === "smart_match" ? (
                            <Compass className="size-3" />
                          ) : d.source === "quick_match" ? (
                            <Zap className="size-3" />
                          ) : (
                            <Layers className="size-3" />
                          )}
                          {d.source === "smart_match"
                            ? "Smart Match"
                            : d.source === "quick_match"
                            ? "Quick Match"
                            : "Direct Package"}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            path === "package"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : path === "guided"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : path === "quick"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20"
                          }`}
                        >
                          {path === "package" ? (
                            <Sparkles className="size-3" />
                          ) : path === "guided" ? (
                            <Compass className="size-3" />
                          ) : path === "quick" ? (
                            <Zap className="size-3" />
                          ) : (
                            <MessageSquareText className="size-3" />
                          )}
                          {path === "package"
                            ? `Package: ${d?.package_name || "Direct Pack"}`
                            : path === "guided"
                            ? "Guided Discovery"
                            : path === "quick"
                            ? "Quick Request"
                            : "Free Text"}
                        </span>
                      )}

                      {/* Converted badge */}
                      {r.converted_project_id ? (
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="size-3" /> Converted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          New
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Email: {r.email}</span>
                      {r.phone && <span>Phone: {r.phone}</span>}
                      {r.preferred_contact && (
                        <span className="font-medium text-foreground">
                          Preferred: {r.preferred_contact}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground shrink-0 sm:text-right">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Structured Brief Content */}
                {d ? (
                  <div className="space-y-4">
                    {/* SMART PACKAGE MATCHER RECOMMENDATION DOSSIER */}
                    {d.recommendation && (
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-primary/20 flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                            <Sparkles className="size-4" />
                            Smart Package Matcher Recommendation
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-primary text-primary-foreground">
                              {d.recommendation.score}% Match Score
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-card text-foreground border border-border">
                              {d.recommendation.matchLevel === "strong"
                                ? "Strong Match"
                                : d.recommendation.matchLevel === "good"
                                ? "Good Match"
                                : "Compatible Fit"}
                            </span>
                            {d.recommendation.isUnpublished && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                Tailored Solution
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">
                              Recommended Package
                            </span>
                            <span className="font-bold text-primary text-sm">
                              {d.recommendation.packageName || r.service}
                            </span>
                            {d.recommendation.packageCode && (
                              <span className="text-[10px] font-mono text-muted-foreground block">
                                Code: {d.recommendation.packageCode}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">
                              Entry Path
                            </span>
                            <span className="font-semibold text-foreground capitalize">
                              {(d.source || "smart_match").replace("_", " ")}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">
                              Business Profile
                            </span>
                            <span className="font-semibold text-foreground">
                              {d.qualification?.businessType || d.business_type || "—"}
                              {d.qualification?.marketScope ? ` (${d.qualification.marketScope})` : ""}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">
                              Investment & Timeline
                            </span>
                            <span className="font-semibold text-foreground">
                              {d.qualification?.budgetRange ? d.qualification.budgetRange.replace("_", " ") : r.budget || "Flexible"}
                              {d.qualification?.startTimeline ? ` · ${d.qualification.startTimeline}` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Factual reasons list */}
                        {d.recommendation.reasons && d.recommendation.reasons.length > 0 && (
                          <div className="pt-2 border-t border-primary/15 text-xs space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">
                              Why this package was recommended:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {d.recommendation.reasons.map((reason: string, rIdx: number) => (
                                <div key={rIdx} className="flex items-center gap-1.5 text-foreground/90 bg-card/60 p-1.5 rounded-lg border border-border/50 text-[11px]">
                                  <Check className="size-3 text-primary shrink-0 stroke-[3]" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* DIRECT PACKAGE SELECTION HIGHLIGHT */}
                    {isPackage && (
                      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            <Sparkles className="size-4" />
                            Direct Package Selection Intent
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            Pre-Selected Plan
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">Source</span>
                            <span className="font-semibold text-foreground">Pricing / Package Selection</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">Package</span>
                            <span className="font-bold text-primary">
                              {d.package_name || r.service || "SADA Package"}
                              {d.package_price ? ` (${Number(d.package_price).toLocaleString()} ${d.package_currency || "TND"} / ${d.package_unit || "mo"})` : ""}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">Business & Category</span>
                            <span className="font-semibold text-foreground">
                              {r.business_name || d.business_name || "—"} · {d.business_type || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-mono">Primary Priority</span>
                            <span className="font-bold text-foreground">
                              {d.primary_priority || d.main_problem || "—"}
                            </span>
                          </div>
                        </div>

                        {d.package_features && d.package_features.length > 0 && (
                          <div className="pt-2 border-t border-purple-500/15 text-xs">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5 font-mono">
                              Included Deliverables:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {d.package_features.map((feat: string) => (
                                <span
                                  key={feat}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-card border border-border text-foreground font-medium"
                                >
                                  ✓ {feat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {d.optional_message && (
                          <div className="pt-2 border-t border-purple-500/15 text-xs">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1 font-mono">
                              Client Note:
                            </span>
                            <p className="text-foreground italic bg-card p-2.5 rounded-lg border border-border/60">
                              "{d.optional_message}"
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 10-SECOND LEAD BRIEF STRIP */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/70">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Business & Stage
                        </div>
                        <div className="font-semibold text-foreground mt-0.5 truncate">
                          {d.business_type || r.business_name || "—"}
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">
                          {d.business_stage || "Operating"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Primary Problem
                        </div>
                        <div
                          className="font-semibold text-foreground mt-0.5 truncate"
                          title={d.root_problem || d.what_brought_here?.[0] || "—"}
                        >
                          {d.root_problem || d.what_brought_here?.[0] || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Primary Goal
                        </div>
                        <div
                          className="font-semibold text-primary mt-0.5 flex items-center gap-1 truncate"
                          title={d.main_problem || "—"}
                        >
                          <Target className="size-3 text-primary shrink-0" />
                          <span className="truncate">{d.main_problem || "—"}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Priority Service
                        </div>
                        <div
                          className="font-semibold text-foreground mt-0.5 truncate"
                          title={d.priority_service || r.service || "—"}
                        >
                          {d.priority_service || r.service || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Timeline
                        </div>
                        <div className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground shrink-0" />
                          <span>{d.timeline || "—"}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Budget
                        </div>
                        <div className="font-semibold text-foreground mt-0.5 flex items-center gap-1 truncate">
                          <DollarSign className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {d.budget_range || d.budget_preference || r.budget || "Flexible"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Requested Services Pills */}
                    {d.services_needed && d.services_needed.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Layers className="size-3" />
                          Requested:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {d.services_needed.map((srv: string) => {
                            const isPriority = d.priority_service === srv;
                            return (
                              <span
                                key={srv}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                  isPriority
                                    ? "border-primary bg-primary text-white font-semibold"
                                    : "border-border bg-card text-foreground"
                                }`}
                              >
                                {srv} {isPriority && "★ (Priority)"}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* REQUEST SUMMARY BANNER */}
                    {d.request_summary && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                          <Sparkles className="size-3.5" />
                          Request Summary
                        </div>
                        <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                          "{d.request_summary}"
                        </p>
                      </div>
                    )}

                    {/* SECTION A: WHAT THE CLIENT TOLD US */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          <span className="size-2 rounded-full bg-blue-500" />
                          What the Client Told Us
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          Client-Provided Facts
                        </span>
                      </div>

                      {/* Business Context (industry specific) */}
                      {d.business_situation_details && d.business_situation_details.trim() && (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="size-3 text-primary" />
                            Business Context · {getIndustryContextLabel(d.business_type)}
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                            {d.business_situation_details.trim()}
                          </p>
                        </div>
                      )}

                      {/* What brought them / challenges */}
                      {((d.what_brought_here && d.what_brought_here.length > 0) || d.what_brought_here_custom) && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Challenges / What Brought Them:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(d.what_brought_here || []).map((item: string) => (
                              <span
                                key={item}
                                className="px-2.5 py-0.5 rounded-md text-xs bg-secondary text-foreground border border-border"
                              >
                                {item}
                              </span>
                            ))}
                            {d.what_brought_here_custom && (
                              <span className="px-2.5 py-0.5 rounded-md text-xs bg-secondary text-foreground border border-border italic">
                                "{d.what_brought_here_custom}"
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* What they tried */}
                      {((d.what_tried && d.what_tried.length > 0) || d.what_tried_notes) && (
                        <div className="text-xs space-y-1">
                          <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
                            What They Tried:
                          </span>
                          {d.what_tried && d.what_tried.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {d.what_tried.map((item: string) => (
                                <span
                                  key={item}
                                  className="px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[11px]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                          {d.what_tried_notes && d.what_tried_notes.trim() && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              Note: "{d.what_tried_notes.trim()}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Client direct description / notes */}
                      {(d.raw_description || d.additional_notes) && (
                        <div className="text-xs space-y-1">
                          <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
                            Direct Client Notes:
                          </span>
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border/40">
                            {d.raw_description || d.additional_notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* SECTION B: SADA PRELIMINARY DIRECTION */}
                    {d.likely_needs && d.likely_needs.length > 0 && (
                      <div className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4 space-y-2.5">
                        <div className="flex items-center justify-between pb-1 border-b border-primary/15">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                            <Sparkles className="size-3.5" />
                            SADA Preliminary Direction
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Potential Focus
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {d.likely_needs.map((item: string, idx: number) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-primary/30 text-foreground soft-shadow"
                            >
                              <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] grid place-items-center font-bold">
                                {idx + 1}
                              </span>
                              {item}
                            </span>
                          ))}
                        </div>

                        <p className="text-[11px] text-muted-foreground italic leading-relaxed pt-1">
                          Based on the information provided, these services may be relevant. Final recommendations are made by the SADA team.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback display for legacy contact submissions */
                  <div className="space-y-2 text-xs">
                    <p className="whitespace-pre-wrap text-foreground bg-muted/20 p-3 rounded-xl border border-border/50">
                      {r.message}
                    </p>
                    <div className="text-muted-foreground flex gap-4">
                      {r.service && <span>Service: {r.service}</span>}
                      {r.budget && <span>Budget: {r.budget}</span>}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border/50 flex-wrap items-center">
                  <a
                    href={`mailto:${r.email}`}
                    className="inline-flex items-center gap-1.5 bg-gradient-primary text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:scale-[1.02] transition-transform"
                  >
                    <Mail className="size-3" />
                    Reply via Email
                  </a>

                  {r.phone && (
                    <a
                      href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <MessageCircle className="size-3" />
                      WhatsApp
                    </a>
                  )}

                  {!r.converted_project_id ? (
                    <button
                      onClick={() => setConverting(r)}
                      className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/10 text-primary px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <ArrowRight className="size-3" />
                      Convert to Project
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        navigate({
                          to: "/admin/client-projects/$id" as any,
                          params: { id: r.converted_project_id } as any,
                        })
                      }
                      className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <ArrowRight className="size-3" />
                      View Linked Project
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (r.converted_project_id) {
                        toast.error(
                          "Cannot delete inquiry: This inquiry is linked to an active converted project and must be preserved for audit history."
                        );
                        return;
                      }
                      setDeleteTargetId(r.id);
                    }}
                    title={
                      r.converted_project_id
                        ? "Linked to operational project (preserved for audit trail)"
                        : "Delete inquiry"
                    }
                    className={`inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 rounded-lg text-xs transition-colors ml-auto cursor-pointer ${
                      r.converted_project_id
                        ? "opacity-40 cursor-not-allowed hover:bg-card text-muted-foreground"
                        : "hover:bg-destructive hover:text-white hover:border-destructive"
                    }`}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Convert to Project modal */}
      {converting && (
        <ConvertToProjectModal
          inquiry={converting}
          onConverted={(projectId) => {
            load();
            navigate({
              to: "/admin/client-projects/$id" as any,
              params: { id: projectId } as any,
            });
          }}
          onClose={() => setConverting(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <SADAConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Inquiry?"
        description="Are you sure you want to delete this client inquiry? This record will be permanently removed."
        confirmLabel={deleting ? "Deleting…" : "Delete Inquiry"}
        variant="destructive"
        isLoading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
