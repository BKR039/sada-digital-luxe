import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  type SadaRole,
  normalizeRole,
  getRoleLabel,
  canManageRoles,
  canDeleteTeamMember,
} from "@/lib/permissions";
import { upsertSalaryRecord } from "@/lib/finance-service";
import { format } from "date-fns";
import {
  X, Save, User, Briefcase, Mail, Globe, Eye, EyeOff, ShieldCheck,
  Upload, Trash2, RefreshCw, Loader2, Sparkles, Image as ImageIcon, AlertCircle, Lock,
  Wallet, DollarSign
} from "lucide-react";
import type { TeamMemberRow } from "@/components/admin/project-utils";
import { SADASwitch, SADACounter, SADAInput, SADAButton } from "@/components/ui/sada-ui";
import { SADADialog } from "@/components/ui/sada-dialog";
import { SADAConfirmDialog } from "@/components/ui/sada-confirm-dialog";

interface Props {
  member?: TeamMemberRow | null;
  onSaved: () => void;
  onClose: () => void;
}

const DIVISIONS = ["Marketing", "Development", "Production", "Executive", "Design"];
const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { value: "busy", label: "Busy", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { value: "overloaded", label: "Overloaded", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  { value: "on_leave", label: "On Leave", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
];

export function TeamMemberModal({ member, onSaved, onClose }: Props) {
  const isEditing = Boolean(member?.id);
  const { role: currentUserRole, isSuperAdmin } = useAuth();

  // Form State
  const [name, setName] = useState(member?.name || "");
  const [position, setPosition] = useState(member?.position || "");
  const [positionAr, setPositionAr] = useState(member?.position_ar || "");
  const [division, setDivision] = useState(member?.division || "Development");
  const [memberRole, setMemberRole] = useState<SadaRole>(
    member?.role ? normalizeRole(member.role) : "worker"
  );
  const [specialtiesInput, setSpecialtiesInput] = useState((member?.specialties || []).join(", "));
  const [email, setEmail] = useState(member?.email || "");
  const [bio, setBio] = useState(member?.bio || "");
  const [bioAr, setBioAr] = useState(member?.bio_ar || "");
  const [photoUrl, setPhotoUrl] = useState(member?.photo_url || "");
  const [linkedinUrl, setLinkedinUrl] = useState(member?.socials?.linkedin || "");
  const [behanceUrl, setBehanceUrl] = useState(member?.socials?.behance || "");
  const [instagramUrl, setInstagramUrl] = useState(member?.socials?.instagram || "");
  const [sortOrder, setSortOrder] = useState(member?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [published, setPublished] = useState(member?.published ?? false);
  const [availabilityStatus, setAvailabilityStatus] = useState<"available" | "busy" | "overloaded" | "on_leave">(
    member?.availability_status || "available"
  );
  const [employmentType, setEmploymentType] = useState<"full_time" | "part_time" | "freelance" | "intern">(
    (member?.employment_type as any) || "full_time"
  );

  // Compensation / Salary Profile State
  const [baseSalary, setBaseSalary] = useState<string>("");
  const [salaryFrequency, setSalaryFrequency] = useState<string>("monthly");
  const [standardHours, setStandardHours] = useState<number>(160);
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer");
  const [salaryStatus, setSalaryStatus] = useState<string>("active");
  const [loadingSalary, setLoadingSalary] = useState(false);

  useEffect(() => {
    if (member?.id) {
      setLoadingSalary(true);
      (supabase as any)
        .from("salary_records")
        .select("*")
        .eq("team_member_id", member.id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setBaseSalary(String(data.base_amount || ""));
            setSalaryFrequency(data.payment_frequency || "monthly");
            setStandardHours(data.standard_monthly_hours || 160);
            setPaymentMethod(data.payment_method || "Bank Transfer");
            setSalaryStatus(data.status || "active");
          }
        })
        .finally(() => setLoadingSalary(false));
    }
  }, [member?.id]);

  // Save & Upload States
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Photo Upload directly to Supabase Storage
  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setPhotoError(null);

    // Validate MIME Type
    if (!file.type.startsWith("image/")) {
      setPhotoError("Invalid file type. Please upload an image file (PNG, JPG, WEBP, or GIF).");
      return;
    }

    // Validate File Size (max 5MB)
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      setPhotoError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed size is ${MAX_MB}MB.`);
      return;
    }

    setUploadingPhoto(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `team-avatars/${Date.now()}_${sanitizedName}`;

      const { error: uploadErr } = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: true,
      });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);
      if (!publicUrlData?.publicUrl) {
        throw new Error("Failed to resolve public image URL from storage.");
      }

      setPhotoUrl(publicUrlData.publicUrl);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      setPhotoError(err.message || "Failed to upload profile photo to storage.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Member name is required.");
      return;
    }
    if (!position.trim()) {
      setError("Role / Position is required.");
      return;
    }
    if (published && name.includes("@")) {
      setError("Public team members must have a valid display name (not an email address).");
      return;
    }

    setSaving(true);
    setError(null);

    const specialtiesArray = specialtiesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const socialsObj: Record<string, string> = {};
    if (linkedinUrl.trim()) socialsObj.linkedin = linkedinUrl.trim();
    if (behanceUrl.trim()) socialsObj.behance = behanceUrl.trim();
    if (instagramUrl.trim()) socialsObj.instagram = instagramUrl.trim();

    // Role validation: Only Super Admin can assign/change admin or super_admin
    const originalRole = member?.role ? normalizeRole(member.role) : "worker";
    if (!isSuperAdmin && memberRole !== "worker" && memberRole !== originalRole) {
      setError("Unauthorized: Only Super Admin can grant Admin or Super Admin roles.");
      setSaving(false);
      return;
    }

    const numSalary = parseFloat(baseSalary);
    const hourlyCost = !isNaN(numSalary) && numSalary > 0 && standardHours > 0
      ? Math.round((numSalary / standardHours) * 100) / 100
      : null;

    const payload: Record<string, any> = {
      name: name.trim(),
      position: position.trim(),
      position_ar: positionAr.trim() || null,
      division,
      role: memberRole,
      specialties: specialtiesArray,
      email: email.trim() || null,
      bio: bio.trim() || null,
      bio_ar: bioAr.trim() || null,
      photo_url: photoUrl.trim() || null,
      socials: socialsObj,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
      published,
      availability_status: availabilityStatus,
      employment_type: employmentType,
      updated_at: new Date().toISOString(),
    };
    if (hourlyCost !== null) {
      payload.hourly_cost = hourlyCost;
    }

    try {
      let savedMemberId = member?.id;

      if (isEditing && member) {
        // Verify if member exists in team_members table (or is an in-memory synthesized profile)
        const { data: existingTm } = await (supabase as any)
          .from("team_members")
          .select("id")
          .eq("id", member.id)
          .maybeSingle();

        if (existingTm) {
          const { error: err } = await (supabase as any)
            .from("team_members")
            .update(payload)
            .eq("id", member.id);
          if (err) throw err;
        } else {
          // Synthesized profile without team_members row: insert new authoritative record linked to profile_id
          const insertPayload = {
            ...payload,
            profile_id: member.profile_id || member.id,
          };
          const { data: created, error: err } = await (supabase as any)
            .from("team_members")
            .insert([insertPayload])
            .select("id")
            .single();
          if (err) throw err;
          savedMemberId = created?.id;
        }

        if ((member.profile_id || member.id) && isSuperAdmin) {
          await (supabase as any).from("user_roles").upsert(
            { user_id: member.profile_id || member.id, role: memberRole },
            { onConflict: "user_id,role" }
          );
        }
      } else {
        const { data: created, error: err } = await (supabase as any)
          .from("team_members")
          .insert([payload])
          .select("id")
          .single();
        if (err) throw err;
        savedMemberId = created?.id;
      }

      // Save Authoritative Base Salary & Compensation Profile if provided
      if (savedMemberId && baseSalary.trim()) {
        if (!isNaN(numSalary) && numSalary >= 0) {
          await upsertSalaryRecord({
            teamMemberId: savedMemberId,
            baseAmount: numSalary,
            standardMonthlyHours: standardHours,
            salaryType: "monthly",
            paymentFrequency: salaryFrequency,
            paymentMethod: paymentMethod,
            status: salaryStatus,
            effectiveDate: format(new Date(), "yyyy-MM-dd"),
          });
        }
      }

      toast.success(isEditing ? "Team member updated successfully" : "Team member created successfully");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save team member.");
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const confirmDeleteMember = async () => {
    if (!canDeleteTeamMember(currentUserRole) || !member) {
      setError("Unauthorized: Only Super Admin can permanently delete team members.");
      return;
    }

    setDeleting(true);
    try {
      const { error: delErr } = await (supabase as any)
        .from("team_members")
        .delete()
        .eq("id", member.id);
      if (delErr) throw delErr;

      toast.success("Team member deleted");
      setShowDeleteConfirm(false);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete team member.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SADADialog
        open={true}
        onOpenChange={(open) => !open && onClose()}
        size="large"
        title={
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
              <User className="size-4.5" />
            </div>
            <div>
              <span className="font-display font-bold text-base text-foreground block">
                {isEditing ? "Edit SADA Team Member" : "Add SADA Team Member"}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Unified operational identity and public website profile
              </span>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isEditing && member && isSuperAdmin && (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  {deleting ? "Deleting…" : "Delete Member"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="team-member-form"
                disabled={saving || uploadingPhoto || deleting}
                className="px-5 py-2 rounded-xl bg-primary text-white font-semibold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving Member..." : isEditing ? "Update Team Member" : "Add Team Member"}
              </button>
            </div>
          </div>
        }
      >
        <form id="team-member-form" onSubmit={handleSave} className="space-y-7">
          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: PROFILE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> 1. PROFILE
              </span>
              <span className="text-[11px] text-muted-foreground">Core identity & avatar photo</span>
            </div>

            {/* Profile Photo Uploader */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Profile Photo
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed p-4 transition-all ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : photoError
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border bg-muted/20 hover:border-primary/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                />

                {uploadingPhoto ? (
                  <div className="flex items-center justify-center gap-3 py-4 text-xs font-semibold text-primary">
                    <Loader2 className="size-5 animate-spin" />
                    <span>Uploading photo to SADA Storage…</span>
                  </div>
                ) : photoUrl ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={photoUrl}
                      alt="Profile preview"
                      className="size-20 rounded-2xl object-cover ring-2 ring-primary/30 shrink-0 shadow-sm"
                    />
                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                        <ImageIcon className="size-3.5 text-emerald-500" /> Photo Uploaded & Saved
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {photoUrl}
                      </p>
                      <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                        >
                          <RefreshCw className="size-3 text-primary" /> Replace Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoUrl("")}
                          className="px-3 py-1.5 rounded-xl border border-destructive/20 bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 className="size-3" /> Remove Photo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center text-center p-4 cursor-pointer group"
                  >
                    <div className="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-2 group-hover:scale-105 transition-transform">
                      {name.trim() ? (
                        <span className="font-display font-bold text-xl">{name[0].toUpperCase()}</span>
                      ) : (
                        <Upload className="size-6" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      Click to upload profile photo <span className="text-muted-foreground font-normal">or drag and drop</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      PNG, JPG, WEBP or GIF up to 5MB (stored in Supabase Storage)
                    </p>
                  </div>
                )}
              </div>

              {photoError && (
                <div className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}
            </div>

            {/* Name & Position */}
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Yara El-Sayed"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Role / Position (EN) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Creative Director"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Arabic Role / Position for Website */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                المسمى الوظيفي (العربية — لموقع صدى)
              </label>
              <input
                type="text"
                dir="rtl"
                value={positionAr}
                onChange={(e) => setPositionAr(e.target.value)}
                placeholder="مثال: المدير الإبداعي"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-right"
              />
            </div>

            {/* Division */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Division
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DIVISIONS.map((div) => {
                  const selected = division === div;
                  return (
                    <button
                      key={div}
                      type="button"
                      onClick={() => setDivision(div)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        selected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {div}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: OPERATIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> 2. OPERATIONS
              </span>
              <span className="text-[11px] text-muted-foreground">Internal Work OS details & load</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operational Email (Internal)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yara@sada.agency"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Availability Status
                </label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const selected = availabilityStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAvailabilityStatus(opt.value as any)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          selected
                            ? `${opt.color} font-bold ring-1 ring-primary/40`
                            : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Employment Type */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Employment Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: "full_time", label: "Full-Time Employee" },
                    { id: "part_time", label: "Part-Time" },
                    { id: "freelance", label: "Freelancer / Contract" },
                    { id: "intern", label: "Intern" },
                  ].map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setEmploymentType(emp.id as any)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-center ${
                        employmentType === emp.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {emp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2 sm:col-span-2 p-4 rounded-2xl border border-border bg-card/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  SADA Works Role <span className="text-destructive">*</span>
                </label>
                {!isSuperAdmin && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Lock className="size-3" /> Super Admin controlled
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["super_admin", "admin", "worker"] as const).map((r) => {
                  const isSelected = memberRole === r;
                  const canSelect = isSuperAdmin || (r === "worker" && (!member?.role || member.role === "worker"));
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => setMemberRole(r)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all border text-center flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? r === "super_admin"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-xs ring-1 ring-purple-500/30 font-bold"
                            : r === "admin"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-xs ring-1 ring-blue-500/30 font-bold"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                          : canSelect
                          ? "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                          : "bg-muted/20 border-border/40 text-muted-foreground/40 cursor-not-allowed"
                      }`}
                    >
                      <span className="uppercase text-[11px] tracking-wider">{getRoleLabel(r)}</span>
                      <span className="text-[9px] font-normal opacity-70">
                        {r === "super_admin" ? "Full System" : r === "admin" ? "Management" : "Execution"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {memberRole === "super_admin" && "Super Admin has full system authority, role management, and permanent delete permissions."}
                {memberRole === "admin" && "Admin can manage task definitions, deadlines, priorities, and assignments (no deletion)."}
                {memberRole === "worker" && "Worker can update execution progress, deliverables, time, and notes on assigned tasks."}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
              <SADASwitch
                checked={isActive}
                onCheckedChange={setIsActive}
                label="Active Team Member"
                description="Includes member in task assignments & capacity workload tracking"
              />
            </div>
          </div>

          {/* SECTION 3: PUBLIC PROFILE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Globe className="size-3.5" /> 3. PUBLIC PROFILE
              </span>
              <span className="text-[11px] text-muted-foreground">Bio, specialties & social media</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Public Bio (English)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Short bio for public SADA website..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  نبذة تعريفية (العربية)
                </label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={bioAr}
                  onChange={(e) => setBioAr(e.target.value)}
                  placeholder="نبذة مختصرة لعرضها في موقع صدى..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-right"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Specialties (Comma Separated)
              </label>
              <input
                type="text"
                value={specialtiesInput}
                onChange={(e) => setSpecialtiesInput(e.target.value)}
                placeholder="e.g. Brand & Art Direction, Web Development, UI/UX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Social Links (Public)
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn URL"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="url"
                  value={behanceUrl}
                  onChange={(e) => setBehanceUrl(e.target.value)}
                  placeholder="Behance URL"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="Instagram URL"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: COMPENSATION & SALARY STRUCTURE (AUTHORITATIVE) */}
          <div className="space-y-4 p-4 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Wallet className="size-3.5" /> 4. COMPENSATION & BASE SALARY (AUTHORITATIVE)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Used for P&L, Cost Rate & Salary Advance</span>
            </div>

            {loadingSalary ? (
              <div className="p-4 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Loading salary profile...</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                      Base Monthly Salary (TND)
                    </label>
                    <SADAInput
                      type="number"
                      step="0.001"
                      min="0"
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(e.target.value)}
                      placeholder="e.g. 1400"
                      prefix="TND"
                      className="font-mono text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                      Authoritative gross base monthly compensation
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                      Standard Monthly Hours
                    </label>
                    <SADAInput
                      type="number"
                      min="1"
                      max="300"
                      value={String(standardHours)}
                      onChange={(e) => setStandardHours(parseInt(e.target.value) || 160)}
                      className="font-mono text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                      Used to compute internal hourly cost rate
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                      Payment Frequency
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["monthly", "biweekly", "weekly"].map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setSalaryFrequency(freq)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                            salaryFrequency === freq
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                              : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                      Disbursement Method
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["Bank Transfer", "Cash", "Check"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                            paymentMethod === m
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                              : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Breakdown Pill */}
                {parseFloat(baseSalary) > 0 && (
                  <div className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Hourly Cost Rate: </span>
                      <span className="font-bold text-primary">
                        {(parseFloat(baseSalary) / (standardHours || 160)).toFixed(2)} TND/hr
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Early Advance (50%): </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {(parseFloat(baseSalary) * 0.5).toFixed(3)} TND
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 5: WEBSITE & PUBLISHING */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Eye className="size-3.5" /> 5. WEBSITE & PUBLISHING
              </span>
              <span className="text-[11px] text-muted-foreground">Public visibility on /about</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                <SADASwitch
                  checked={published}
                  onCheckedChange={setPublished}
                  label={
                    <span className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      {published ? <Eye className="size-3.5 text-emerald-500" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                      Public Visibility
                    </span>
                  }
                  description="Publish member on SADA website /about page"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Display Order
                </label>
                <SADACounter
                  value={sortOrder}
                  onChange={setSortOrder}
                  min={0}
                  max={999}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </form>
      </SADADialog>

      <SADAConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Permanently Delete Team Member?"
        description={`Are you sure you want to permanently delete team member "${member?.name}"? This action is authorized for Super Admins only and cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete Member"}
        variant="destructive"
        isLoading={deleting}
        onConfirm={confirmDeleteMember}
      />
    </>
  );
}
