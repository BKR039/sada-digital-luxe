import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  User,
  Quote,
  Link2,
  Sparkles,
  Globe,
  AlertTriangle,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { permissions, normalizeRole } from "@/lib/permissions";
import { SADAInput, SADATextarea } from "@/components/ui/sada-input";
import {
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  validateTestimonialReadiness,
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
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADACounter } from "@/components/ui/sada-counter";
import {
  EditorCommandBar,
  EditorSectionNav,
  EditorSection,
  EditorField,
  ToggleRow,
  editorInputClass,
  editorTextareaClass,
  useUnsavedChangesWarning,
  useDirtyTracker,
  type EditorSectionDef,
} from "@/components/admin/content/ContentEditorShell";
import { LANGUAGE_OPTIONS, truncate } from "@/components/admin/content/content-utils";
import { DIVISIONS } from "@/data/services";

export const Route = createFileRoute("/admin/testimonials/$id")({
  component: ClientProofEditor,
});

type SectionKey = "client" | "quote" | "context" | "presentation" | "publishing";

const SECTIONS: EditorSectionDef<SectionKey>[] = [
  { id: "client", label: "Client", icon: User },
  { id: "quote", label: "Testimonial", icon: Quote },
  { id: "context", label: "Context", icon: Link2 },
  { id: "presentation", label: "Presentation", icon: Sparkles },
  { id: "publishing", label: "Publishing", icon: Globe },
];

interface ClientOption {
  id: string;
  name: string;
  contact_name: string | null;
  industry: string | null;
}

interface ProjectOption {
  id: string;
  title: string;
  client: string | null;
}

/** Service options come from the canonical services data, not a second hardcoded list. */
const SERVICE_OPTIONS = [
  ...DIVISIONS.map((d) => ({ value: d.name, label: `${d.name} (division)` })),
  ...Array.from(new Set(DIVISIONS.flatMap((d) => d.services))).map((s) => ({ value: s, label: s })),
];

function ClientProofEditor() {
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
  const [activeSection, setActiveSection] = useState<SectionKey>("client");

  // Client
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [clientRole, setClientRole] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Testimonial
  const [review, setReview] = useState("");
  const [shortQuote, setShortQuote] = useState("");
  const [language, setLanguage] = useState("en");

  // Context
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [service, setService] = useState("");

  // Presentation
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(10);

  // Publishing
  const [published, setPublished] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [showChecklist, setShowChecklist] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const snapshot = JSON.stringify({
    clientName,
    company,
    clientRole,
    photoUrl,
    review,
    shortQuote,
    language,
    clientId,
    projectId,
    service,
    featured,
    sortOrder,
    published,
  });
  const { dirty, commit } = useDirtyTracker(snapshot, !loading);
  useUnsavedChangesWarning(dirty);

  // Canonical entities available for linking.
  useEffect(() => {
    let active = true;
    (async () => {
      const [clientRes, projectRes] = await Promise.all([
        (supabase as any).from("clients").select("id, name, contact_name, industry").order("name"),
        (supabase as any)
          .from("projects")
          .select("id, title, client")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (clientRes.data) setClients(clientRes.data);
      if (projectRes.data) setProjects(projectRes.data);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("testimonials")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !data) throw error || new Error("Client proof not found");
        if (!active) return;

        setClientName(data.client_name || "");
        setCompany(data.company || "");
        setClientRole(data.role || "");
        setPhotoUrl(data.photo_url || null);
        setReview(data.review || "");
        setShortQuote(data.short_quote || "");
        setLanguage(data.language || "en");
        setClientId(data.client_id || "");
        setProjectId(data.project_id || "");
        setService(data.service || "");
        setFeatured(!!data.featured);
        setSortOrder(data.sort_order ?? 10);
        setPublished(!!data.published);
      } catch (err: any) {
        toast.error(err.message || "Failed to load client proof");
        nav({ to: "/admin/testimonials" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isNew, nav]);

  const checklist = useMemo(() => {
    return validateTestimonialReadiness({
      client_name: clientName,
      review,
      company,
      role: clientRole,
      client_id: clientId,
      project_id: projectId,
    });
  }, [clientName, review, company, clientRole, clientId, projectId]);

  const buildPayload = useCallback(
    (nextPublished: boolean) => ({
      client_name: clientName.trim(),
      company: company.trim() || null,
      role: clientRole.trim() || null,
      photo_url: photoUrl,
      review: review.trim(),
      short_quote: shortQuote.trim() || null,
      language: language || "en",
      client_id: clientId || null,
      project_id: projectId || null,
      service: service.trim() || null,
      featured,
      sort_order: sortOrder,
      published: nextPublished,
    }),
    [
      clientName,
      company,
      clientRole,
      photoUrl,
      review,
      shortQuote,
      language,
      clientId,
      projectId,
      service,
      featured,
      sortOrder,
    ],
  );

  const handleSave = async (targetPublished?: boolean) => {
    if (!canEdit) {
      toast.error("You do not have permission to edit client proof.");
      return;
    }
    const nextPublished = targetPublished !== undefined ? targetPublished : published;

    if (!clientName.trim()) {
      toast.error("Record who said this before saving.");
      setActiveSection("client");
      return;
    }
    if (!review.trim()) {
      toast.error("A testimonial needs the client's actual words.");
      setActiveSection("quote");
      return;
    }
    if (nextPublished && !checklist.allPassed) {
      setShowChecklist(true);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(nextPublished);
      if (isNew) {
        const inserted = await createTestimonial(payload, {
          ctx: permCtx,
          actorRole: currentRole,
          actorId: user?.id,
        });
        toast.success(nextPublished ? "Client proof published" : "Draft saved");
        commit(snapshot);
        nav({ to: "/admin/testimonials/$id", params: { id: inserted.id } });
      } else {
        await updateTestimonial(id, payload, {
          ctx: permCtx,
          actorRole: currentRole,
          actorId: user?.id,
        });
        setPublished(nextPublished);
        commit(JSON.stringify({ ...JSON.parse(snapshot), published: nextPublished }));
        toast.success(nextPublished ? "Client proof published" : "Changes saved to draft");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save client proof");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || isNew) return;
    setDeleting(true);
    try {
      await deleteTestimonial(id, {
        ctx: permCtx,
        actorRole: currentRole,
        actorId: user?.id,
      });
      toast.success("Client proof deleted");
      nav({ to: "/admin/testimonials" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client proof");
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

  const linkedClient = clients.find((c) => c.id === clientId);
  const linkedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EditorCommandBar
        backTo="/admin/testimonials"
        backLabel="Back to Client Proof"
        title={clientName}
        fallbackTitle="New Client Proof"
        subtitle={company || clientRole || "Unattributed"}
        status={published ? "published" : "draft"}
        dirty={dirty}
        saving={saving}
        canEdit={canEdit}
        canDelete={canDelete && !isNew}
        onSaveDraft={() => handleSave(false)}
        onPublish={() => handleSave(true)}
        onUnpublish={() => handleSave(false)}
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
          {/* 01 — CLIENT */}
          <EditorSection
            id="client"
            index="01"
            icon={User}
            title="Who said it"
            description="Attribution the reader can check. Never publish a quote you cannot attribute to a real person."
          >
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <ShieldCheck className="size-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Client proof must be real and verifiable. If a quote is unverified or incomplete,
                save it as a draft — drafts are invisible to the public at the database level.
              </p>
            </div>

            <EditorField label="Client name" required>
              <SADAInput
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="The person who gave the quote"
                size="lg"
                className="font-semibold text-base"
                aria-label="Client name"
              />
            </EditorField>

            <div className="grid sm:grid-cols-2 gap-4">
              <EditorField label="Company">
                <SADAInput
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Their business"
                  size="default"
                  aria-label="Company"
                />
              </EditorField>

              <EditorField label="Role">
                <SADAInput
                  type="text"
                  value={clientRole}
                  onChange={(e) => setClientRole(e.target.value)}
                  placeholder="e.g. Founder"
                  size="default"
                  aria-label="Client role"
                />
              </EditorField>
            </div>

            <EditorField label="Photo" hint="Optional. Falls back to an initial when absent.">
              <MediaUpload
                value={photoUrl}
                onChange={setPhotoUrl}
                folder="testimonials"
                label="Upload photo"
                aspect="aspect-square"
              />
            </EditorField>
          </EditorSection>

          {/* 02 — TESTIMONIAL */}
          <EditorSection
            id="quote"
            index="02"
            icon={Quote}
            title="The testimonial"
            description="Their words, not a paraphrase."
          >
            <EditorField label="Full quote" required counter={`${review.length} chars`}>
              <SADATextarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={6}
                placeholder="Paste the client's words exactly as they gave them."
                dir={language === "ar" ? "rtl" : "ltr"}
                aria-label="Full quote"
              />
            </EditorField>

            <EditorField
              label="Short quote"
              counter={`${shortQuote.length} chars`}
              hint="Optional pull-quote for tight spaces. Falls back to the full quote."
            >
              <SADATextarea
                value={shortQuote}
                onChange={(e) => setShortQuote(e.target.value)}
                rows={2}
                placeholder="The single most quotable line."
                dir={language === "ar" ? "rtl" : "ltr"}
                aria-label="Short quote"
              />
            </EditorField>

            <EditorField label="Language" hint="The language the quote was given in.">
              <SADASelect
                value={language}
                onChange={setLanguage}
                size="lg"
                aria-label="Quote language"
                options={LANGUAGE_OPTIONS}
              />
            </EditorField>
          </EditorSection>

          {/* 03 — CONTEXT */}
          <EditorSection
            id="context"
            index="03"
            icon={Link2}
            title="Context"
            description="Link this proof to the canonical client and case study. Linking references those records — it never copies them."
          >
            <EditorField
              label="Related CRM client"
              hint="Links to public.clients. Client details stay on that record; nothing is duplicated here."
            >
              <SADACombobox
                value={clientId}
                onChange={setClientId}
                clearable
                size="lg"
                placeholder="Not linked to a CRM client"
                searchPlaceholder="Search clients..."
                emptyText="No clients found"
                aria-label="Related CRM client"
                options={clients.map((c) => ({
                  value: c.id,
                  label: c.name,
                  subtitle: [c.contact_name, c.industry].filter(Boolean).join(" · ") || null,
                }))}
              />
            </EditorField>

            <EditorField
              label="Related case study"
              hint="The case study page reads this quote from here — the canonical source stays this record."
            >
              <SADACombobox
                value={projectId}
                onChange={setProjectId}
                clearable
                size="lg"
                placeholder="Not linked to a case study"
                searchPlaceholder="Search case studies..."
                emptyText="No case studies found"
                aria-label="Related case study"
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.title,
                  subtitle: p.client || null,
                }))}
              />
            </EditorField>

            <EditorField label="Related service" hint="Which SADA service this proof speaks to.">
              <SADASelect
                value={service}
                onChange={setService}
                size="lg"
                placeholder="Select a service..."
                aria-label="Related service"
                options={SERVICE_OPTIONS}
              />
            </EditorField>

            {(linkedClient || linkedProject) && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-1.5 text-xs">
                <div className="font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Linked records
                </div>
                {linkedClient && (
                  <div>
                    <span className="text-muted-foreground">Client: </span>
                    <span className="font-semibold">{linkedClient.name}</span>
                  </div>
                )}
                {linkedProject && (
                  <div>
                    <span className="text-muted-foreground">Case study: </span>
                    <span className="font-semibold">{truncate(linkedProject.title, 60)}</span>
                  </div>
                )}
              </div>
            )}
          </EditorSection>

          {/* 04 — PRESENTATION */}
          <EditorSection
            id="presentation"
            index="04"
            icon={Sparkles}
            title="Presentation"
            description="Where this proof sits among the others."
          >
            <ToggleRow
              checked={featured}
              onChange={setFeatured}
              label="Feature this proof"
              description="Featured quotes lead the homepage client section."
            />

            <EditorField label="Sort order" hint="Lower numbers appear first.">
              <SADACounter
                value={sortOrder}
                onChange={setSortOrder}
                min={0}
              />
            </EditorField>
          </EditorSection>

          {/* 05 — PUBLISHING */}
          <EditorSection
            id="publishing"
            index="05"
            icon={Globe}
            title="Publishing"
            description="Only published proof appears on the public site."
          >
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Current state
              </div>
              <p className="text-sm">
                {published
                  ? "Published — visible on the homepage client section."
                  : "Draft — invisible to the public, including by direct query."}
              </p>
            </div>

            <ToggleRow
              checked={published}
              onChange={(v) => handleSave(v)}
              disabled={saving || !canEdit}
              label="Published"
              description="Saves immediately. Publishing runs the verification checklist first."
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
            <DialogDescription>
              Client proof goes on the public site — it has to be complete and attributable.
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

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Permanently delete this client proof?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clientName}'s quote will be removed for good. This cannot be undone.
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
