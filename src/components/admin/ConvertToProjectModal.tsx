import { useState, useEffect, useMemo } from "react";
import { X, ArrowRight, User, Calendar, ShieldCheck, Sparkles, Check, AlertCircle, Clock, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  getStarterChecklistForServices,
  assignStarterTasksIntelligently,
  resolveToProfileId,
  findMatchingClients,
  normalizeEmail,
  normalizePhone,
  type TeamMemberRow,
  type ProfileRow,
  type PreparedStarterTask,
  type ClientRow
} from "./project-utils";
import { format, parseISO } from "date-fns";
import { SADACombobox } from "@/components/ui/sada-combobox";
import { SADADatePicker } from "@/components/ui/sada-date-picker";
import { SADARadioGroup, SADARadioItem } from "@/components/ui/sada-ui";
import { SADADialog } from "@/components/ui/sada-dialog";
import { convertInquiryToProject } from "@/lib/inquiry-service";

interface InquiryRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  service: string | null;
  budget: string | null;
  message: string;
  created_at: string;
  discovery_data?: any;
}

interface Props {
  inquiry: InquiryRow;
  onConverted: (projectId: string) => void;
  onClose: () => void;
}

export function ConvertToProjectModal({ inquiry, onConverted, onClose }: Props) {
  const { user } = useAuth();
  const d = inquiry.discovery_data || {};

  const initialTitle = `${inquiry.business_name || inquiry.name} — ${
    d.package_name || d.priority_service || inquiry.service || "Project"
  }`;
  const initialClientName = inquiry.business_name || inquiry.name;
  const initialBusinessType = d.business_type || d.business_type_custom || "";

  const baseDesc = d.raw_description || d.request_summary || inquiry.message || "";
  const initialDescription = [
    d.package_name ? `[PACKAGE: ${d.package_name}${d.package_price ? ` (${Number(d.package_price).toLocaleString()} ${d.package_currency || "TND"}/${d.package_unit || "mo"})` : ""}]\n` : "",
    baseDesc,
  ]
    .filter(Boolean)
    .join("");

  const initialGoals = d.primary_priority || d.main_problem || d.main_problem_custom || "";
  const initialProblems = [
    d.root_problem || d.root_problem_custom,
    ...(d.what_brought_here || []),
  ]
    .filter(Boolean)
    .join(", ");
  const initialBudget =
    d.budget_range ||
    (d.package_price ? `${Number(d.package_price).toLocaleString()} ${d.package_currency || "TND"} / ${d.package_unit || "mo"}` : null) ||
    d.budget_preference ||
    inquiry.budget ||
    "";
  const initialDeadline = d.timeline || "";

  // Form states
  const [title, setTitle] = useState(initialTitle);
  const [clientName, setClientName] = useState(initialClientName);
  const [clientEmail, setClientEmail] = useState(inquiry.email || "");
  const [clientPhone, setClientPhone] = useState(inquiry.phone || "");
  const [businessType, setBusinessType] = useState(initialBusinessType);
  const [description, setDescription] = useState(initialDescription);
  const [goals, setGoals] = useState(initialGoals);
  const [problems, setProblems] = useState(initialProblems);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deadline, setDeadline] = useState(initialDeadline);
  const [saving, setSaving] = useState(false);

  // CRM Clients state & matching
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [matchedClients, setMatchedClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | "new">("new");

  // Team & Profiles state for Project Lead resolution
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedLeadProfileId, setSelectedLeadProfileId] = useState<string>("");

  useEffect(() => {
    async function loadMembersAndProfiles() {
      setLoadingMembers(true);
      const [tmRes, prRes, clRes] = await Promise.all([
        (supabase as any).from("team_members").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        (supabase as any).from("profiles").select("id, display_name"),
        (supabase as any).from("clients").select("*").order("name", { ascending: true }),
      ]);
      const members: TeamMemberRow[] = tmRes.data || [];
      const profs: ProfileRow[] = prRes.data || [];
      const allClients: ClientRow[] = clRes.data || [];

      setTeamMembers(members);
      setProfiles(profs);
      setClients(allClients);

      // Deterministic candidate matching
      const matches = findMatchingClients(
        {
          email: inquiry.email,
          phone: inquiry.phone,
          business_name: inquiry.business_name,
          name: inquiry.name,
        },
        allClients
      );
      setMatchedClients(matches);
      if (matches.length === 1) {
        setSelectedClientId(matches[0].id);
      } else if (matches.length > 1) {
        setSelectedClientId("");
      } else {
        setSelectedClientId("new");
      }

      // Default lead selection:
      // Priority 1: Current authenticated user if they have an active profile
      // Priority 2: First active team member with a valid profile_id
      if (user?.id && profs.some(p => p.id === user.id)) {
        setSelectedLeadProfileId(user.id);
      } else {
        const firstWithProfile = members.find(m => m.profile_id && profs.some(p => p.id === m.profile_id));
        if (firstWithProfile?.profile_id) {
          setSelectedLeadProfileId(firstWithProfile.profile_id);
        }
      }
      setLoadingMembers(false);
    }
    loadMembersAndProfiles();
  }, [user]);

  // Requested services list
  const requestedServices = useMemo(() => {
    if (d.package_name) {
      return [d.package_name, ...(d.services_needed || [])];
    }
    if (d.services_needed && d.services_needed.length > 0) return d.services_needed;
    if (inquiry.service) return [inquiry.service];
    return [];
  }, [d, inquiry]);

  // Starter task checklist templates
  const starterTemplates = useMemo(() => {
    return getStarterChecklistForServices(requestedServices);
  }, [requestedServices]);

  // Deterministically prepared starter tasks (Assignee + Milestone Due Date)
  const preparedTasks: PreparedStarterTask[] = useMemo(() => {
    return assignStarterTasksIntelligently(
      starterTemplates,
      selectedLeadProfileId,
      teamMembers,
      profiles,
      startDate,
      deadline
    );
  }, [starterTemplates, selectedLeadProfileId, teamMembers, profiles, startDate, deadline]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) {
      toast.error("Title and Client name are required");
      return;
    }

    if (!selectedLeadProfileId) {
      toast.error("Please select an explicit Project Lead for this project.");
      return;
    }

    if (matchedClients.length > 1 && !selectedClientId) {
      toast.error("Multiple potential CRM clients matched. Please explicitly select an option.");
      return;
    }

    setSaving(true);

    const res = await convertInquiryToProject({
      inquiryId: inquiry.id,
      chosenClientId: selectedClientId,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      businessType: businessType.trim(),
      projectTitle: title.trim(),
      projectLeadProfileId: selectedLeadProfileId,
      startDate,
      deadline,
      description,
      goals,
      problems,
      requestedServices,
      starterTasks: preparedTasks.map((t) => ({
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        assignee_id: t.assignee_id,
        deadline: t.deadline,
      })),
      actorId: user?.id,
      actorRole: (user as any)?.role || "super_admin",
    });

    setSaving(false);

    if (!res.success) {
      if (res.ambiguousCandidates) {
        toast.error("Multiple potential CRM clients matched. Please make an explicit selection.");
      } else {
        toast.error(res.error || "Failed to convert inquiry to project.");
      }
      return;
    }

    if (res.alreadyConverted) {
      toast.info("Inquiry has already been converted. Navigating to existing project.");
    } else {
      toast.success(`Project and Client successfully connected with ${res.tasksCreated ?? 0} starter tasks`);
    }

    if (res.projectId) {
      onConverted(res.projectId);
    }
    onClose();
  };

  const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono mb-1.5";

  // Active team members with account status
  const activeMembers = useMemo(() => {
    return teamMembers.map(m => {
      const hasAccount = !!m.profile_id && profiles.some(p => p.id === m.profile_id);
      return {
        ...m,
        hasAccount,
        targetProfileId: m.profile_id || null,
      };
    });
  }, [teamMembers, profiles]);

  const selectedLeadMember = useMemo(() => {
    return activeMembers.find(m => m.targetProfileId === selectedLeadProfileId);
  }, [activeMembers, selectedLeadProfileId]);

  return (
    <SADADialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      size="large"
      title={
        <div>
          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase">
            SADA Work OS · Lead Conversion
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-display text-xl font-bold">Convert Inquiry to Project</span>
            <ArrowRight className="size-4 text-primary" />
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2.5 justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="convert-project-form"
            disabled={saving || !selectedLeadProfileId || (matchedClients.length > 1 && !selectedClientId)}
            className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {saving ? "Creating…" : "Convert & Launch Project"}
          </button>
        </div>
      }
    >
      <form id="convert-project-form" onSubmit={save} className="space-y-6 text-xs">
        {/* Inquiry summary context banner */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs">Inquiry Source Data</span>
              <span className="text-[10px] font-mono text-muted-foreground">ID: {inquiry.id.slice(0, 8)}</span>
            </div>
            <div className="text-muted-foreground">
              <strong className="text-foreground">{inquiry.name}</strong> · {inquiry.email}
              {inquiry.phone && <span> · {inquiry.phone}</span>}
              {inquiry.business_name && <span> · ({inquiry.business_name})</span>}
            </div>
            {requestedServices.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Services:</span>
                {requestedServices.map((s: string, idx: number) => (
                  <span key={idx} className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* =====================================================================
              CRM ENTITY / CLIENT RESOLUTION
          ===================================================================== */}
          <div className="space-y-3 p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <h3 className="font-display font-bold text-sm text-foreground">Client Entity (CRM)</h3>
              </div>
              {matchedClients.length > 1 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                  {matchedClients.length} Potential Matches (Selection Required)
                </span>
              ) : matchedClients.length === 1 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  1 Matched Existing Client
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">New Client Registration</span>
              )}
            </div>

            {matchedClients.length > 0 ? (
              <div className="space-y-2">
                {matchedClients.length > 1 && !selectedClientId ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Multiple CRM clients matched. Please explicitly choose which client to attach this project to, or select 'Create a brand new separate client profile'.</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    The inquiry matches existing CRM client profile(s). Choose whether to attach to an existing client or create a separate client:
                  </p>
                )}
                <SADARadioGroup
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  className="space-y-2 pt-1"
                >
                  {matchedClients.map(mc => (
                    <SADARadioItem
                      key={mc.id}
                      value={mc.id}
                      variant="cards"
                      label={
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{mc.name}</span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {mc.status}
                          </span>
                        </div>
                      }
                      description={
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {mc.contact_name && <span>{mc.contact_name} · </span>}
                          {mc.email && <span>{mc.email} · </span>}
                          {mc.phone && <span>{mc.phone}</span>}
                        </div>
                      }
                      badge={selectedClientId === mc.id ? <CheckCircle2 className="size-4 text-primary shrink-0" /> : undefined}
                    />
                  ))}

                  <SADARadioItem
                    value="new"
                    variant="cards"
                    label={
                      <span className="text-xs font-medium text-foreground">
                        + Create a brand new separate client profile for <strong>{clientName || "this business"}</strong>
                      </span>
                    }
                    badge={selectedClientId === "new" ? <CheckCircle2 className="size-4 text-primary shrink-0" /> : undefined}
                  />
                </SADARadioGroup>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span>
                  No duplicate client found. A new canonical client profile <strong>"{clientName || inquiry.business_name || inquiry.name}"</strong> will be registered and linked.
                </span>
              </div>
            )}
          </div>

          {/* =====================================================================
              SECTION 1: PROJECT SETUP & OWNERSHIP (Project Lead + Dates)
          ===================================================================== */}
          <div className="space-y-4 p-4 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <h3 className="font-display font-bold text-sm text-foreground">Project Setup & Ownership</h3>
              </div>
              <span className="text-[10px] uppercase font-mono text-primary font-bold">REQUIRED</span>
            </div>

            {/* Project Lead Selector */}
            <div className="space-y-1.5">
              <label className={labelCls}>
                Project Lead (Project Owner) *
              </label>
              <SADACombobox
                value={selectedLeadProfileId}
                onChange={(val) => setSelectedLeadProfileId(val)}
                options={activeMembers.map((m) => ({
                  value: m.targetProfileId || "",
                  label: m.name,
                  subtitle: `${m.position} (${m.division})`,
                  avatar: m.photo_url || null,
                  disabled: !m.hasAccount,
                  badge: !m.hasAccount ? "No Account" : undefined,
                }))}
                placeholder="-- Choose Project Lead --"
                searchPlaceholder="Search team members..."
              />

              {selectedLeadMember && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background border border-border/80 mt-2">
                  {selectedLeadMember.photo_url ? (
                    <img
                      src={selectedLeadMember.photo_url}
                      alt={selectedLeadMember.name}
                      className="size-7 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-primary/10 text-primary font-bold grid place-items-center text-xs">
                      {selectedLeadMember.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{selectedLeadMember.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {selectedLeadMember.position} · {selectedLeadMember.division}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Lead Assigned
                  </span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-1">
                The Project Lead is the single accountable owner for overall client communication, delivery coordination, and final delivery sign-off.
              </p>
            </div>

            {/* Project Dates: Start Date & Target Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <span className={labelCls}>Project Start Date *</span>
                <SADADatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  placeholder="Select start date..."
                />
              </div>

              <div className="space-y-1">
                <span className={labelCls}>Target Delivery Date</span>
                <SADADatePicker
                  value={deadline}
                  onChange={(val) => setDeadline(val)}
                  placeholder="Select target delivery..."
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {startDate && deadline ? (
                <span>✓ Milestones will automatically distribute across the timeline.</span>
              ) : (
                <span>ℹ Provide a target delivery date to distribute milestone deadlines automatically.</span>
              )}
            </p>
          </div>

          {/* =====================================================================
              SECTION 2: PROJECT DETAILS & BRIEF
          ===================================================================== */}
          <div className="space-y-4">
            <label className="block">
              <span className={labelCls}>Project Title *</span>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} required />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Client Name *</span>
                <input value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} required />
              </label>
              <label className="block">
                <span className={labelCls}>Business Type</span>
                <input value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="e.g. Restaurant, Hotel, Luxury Retail" className={inputCls} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Client Contact Email</span>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="e.g. contact@business.com"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Client Contact Phone</span>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="e.g. +216 98 765 432"
                  className={inputCls}
                />
              </label>
            </div>

            <label className="block">
              <span className={labelCls}>Project Description</span>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Goals</span>
                <textarea value={goals} onChange={e => setGoals(e.target.value)} placeholder="What does the client want to achieve?" rows={2} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Problems</span>
                <textarea value={problems} onChange={e => setProblems(e.target.value)} placeholder="What problems are they facing?" rows={2} className={inputCls} />
              </label>
            </div>
          </div>

          {/* =====================================================================
              SECTION 3: STARTER TASKS PREVIEW
          ===================================================================== */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-display font-bold text-sm text-foreground">
                  Starter Execution Plan ({preparedTasks.length} tasks)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Intelligent Deterministic Allocation
              </span>
            </div>

            {preparedTasks.length > 0 ? (
              <div className="rounded-2xl border border-border/80 bg-muted/20 divide-y divide-border/60 max-h-56 overflow-y-auto">
                {preparedTasks.map((t, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] grid place-items-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-foreground truncate">{t.title}</div>
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          {t.category} · Priority {t.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[11px]">
                      {/* Suggested Assignee */}
                      <span className="px-2 py-0.5 rounded-md bg-card border border-border text-foreground font-medium flex items-center gap-1">
                        <User className="size-3 text-muted-foreground" />
                        <span>{t.suggested_member_name || "Project Lead"}</span>
                      </span>

                      {/* Deadline */}
                      {t.deadline ? (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-bold flex items-center gap-1">
                          <Calendar className="size-3" />
                          <span>{format(parseISO(t.deadline), "d MMM")}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>Needs date</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-muted-foreground text-xs">
                No starter checklist tasks required for the selected services.
              </div>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              Tasks and assignees can be reconfigured or delegated at any time in the project workspace.
            </p>
          </div>
        </form>
      </SADADialog>
    );
  }
