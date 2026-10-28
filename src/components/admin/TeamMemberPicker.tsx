import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronDown, Search, User, UserX, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  type TeamMemberRow,
  type ProfileRow,
  type TaskRow,
} from "./project-utils";

export interface TeamMemberOption {
  id: string;
  profileId: string | null;
  displayName: string;
  position?: string;
  photoUrl?: string | null;
  hasProfile: boolean;
  role?: string | null;
}

export function getInitials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export interface TeamMemberPickerProps {
  /** The currently selected profile ID or member ID (e.g. assignee_id) */
  value?: string | null;
  /** Callback fired when a team member is selected, or null/empty if unassigned */
  onChange?: (newId: string | null) => void;

  /** Team members list from DB */
  teamMembers?: TeamMemberRow[];
  /** Profiles list from DB */
  profiles?: ProfileRow[];

  /**
   * Display variant:
   * - 'form': Full-width form control with label & chevron (for TaskModal / Task creation)
   * - 'subtask': 2-line trigger with avatar, name, role and secondary CHANGE button (for TaskDetailModal subtasks)
   * - 'compact': Minimal trigger
   */
  variant?: "form" | "subtask" | "compact";

  /** Optional form field label */
  label?: string;
  /** Custom placeholder */
  placeholder?: string;
  /** Custom unassigned label */
  unassignedLabel?: string;
  /** Custom search input placeholder */
  searchPlaceholder?: string;

  /** Permission gate: if false, picker is view-only (no dropdown trigger) */
  canAssign?: boolean;
  /** Spinner state (e.g. while reassigning) */
  isUpdating?: boolean;
  /** Disabled state */
  disabled?: boolean;

  /** Popover alignment relative to trigger ('start' | 'end' | 'center') */
  align?: "start" | "end" | "center";

  /** Language override (defaults to i18n language) */
  isAr?: boolean;

  /** Custom classNames */
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;

  /** Optional subtask object for subtask mode convenience */
  subtask?: TaskRow;
  /** Optional callback alias for subtask mode */
  onAssignChange?: (newId: string | null) => void;
}

export function TeamMemberPicker({
  value,
  onChange,
  teamMembers = [],
  profiles = [],
  variant = "form",
  label,
  placeholder,
  unassignedLabel,
  searchPlaceholder,
  canAssign = true,
  isUpdating = false,
  disabled = false,
  align = variant === "subtask" ? "end" : "start",
  isAr: isArProp,
  className,
  triggerClassName,
  popoverClassName,
  subtask,
  onAssignChange,
}: TeamMemberPickerProps) {
  const { language } = useTranslation();
  const isArabic = isArProp !== undefined ? isArProp : language === "ar";

  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Effective value & callback (supporting subtask shorthand)
  const effectiveValue = subtask ? subtask.assignee_id : value;
  const effectiveOnChange = onAssignChange || onChange;

  // Build unified member options from teamMembers and profiles
  const options = React.useMemo<TeamMemberOption[]>(() => {
    const list: TeamMemberOption[] = [];
    const coveredProfileIds = new Set<string>();

    for (const tm of teamMembers) {
      list.push({
        id: tm.id,
        profileId: tm.profile_id || null,
        displayName: tm.display_name || tm.name,
        position: tm.position,
        photoUrl: tm.photo_url || null,
        hasProfile: Boolean(tm.profile_id),
        role: tm.role || "worker",
      });
      if (tm.profile_id) coveredProfileIds.add(tm.profile_id);
    }

    for (const p of profiles) {
      if (!coveredProfileIds.has(p.id)) {
        list.push({
          id: p.id,
          profileId: p.id,
          displayName: p.display_name || "Team Member",
          position: "Specialist",
          photoUrl: null,
          hasProfile: true,
          role: "worker",
        });
      }
    }

    return list;
  }, [teamMembers, profiles]);

  // Find selected member option
  const selectedMember = React.useMemo<TeamMemberOption | null>(() => {
    if (!effectiveValue) return null;
    return (
      options.find(
        (opt) =>
          (opt.profileId && opt.profileId === effectiveValue) ||
          opt.id === effectiveValue
      ) || null
    );
  }, [options, effectiveValue]);

  // High-precision search filter across name, role, and position
  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((m) => {
      const nameMatch = m.displayName.toLowerCase().includes(q);
      const posMatch = m.position ? m.position.toLowerCase().includes(q) : false;
      const roleMatch = m.role ? m.role.toLowerCase().includes(q) : false;
      return nameMatch || posMatch || roleMatch;
    });
  }, [options, searchQuery]);

  // Determine if Unassigned item should be visible in search results
  const showUnassigned = React.useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const unassignedMatchEn = "unassigned".includes(q) || "no owner".includes(q) || "none".includes(q);
    const unassignedMatchAr = "غير معين".includes(q) || "بدون".includes(q) || "الغاء".includes(q);
    return unassignedMatchEn || unassignedMatchAr;
  }, [searchQuery]);

  const handleSelect = (newId: string | null) => {
    if (effectiveOnChange) {
      effectiveOnChange(newId);
    }
    setOpen(false);
    setSearchQuery("");
  };

  const isInteractive = canAssign && !disabled && !isUpdating;

  // -------------------------------------------------------------------------
  // POPOVER CONTENT
  // -------------------------------------------------------------------------
  const popoverContent = (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions={true}
        className={cn(
          "w-[340px] sm:w-[360px] max-w-[calc(100vw-1.5rem)] p-0 rounded-2xl border border-border/80 dark:border-border/60 bg-popover/98 backdrop-blur-md text-popover-foreground shadow-2xl shadow-black/20 dark:shadow-black/70 z-[100] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
          popoverClassName
        )}
      >
        <CommandPrimitive
          className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground"
          shouldFilter={false}
        >
          {/* Sticky Top Search Bar */}
          <div className="flex items-center border-b border-border/70 px-3.5 py-2.5 bg-muted/20">
            <Search className="me-2.5 size-4 text-muted-foreground/70 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                searchPlaceholder ||
                (isArabic ? "بحث عن عضو في الفريق بالاسم أو الدور..." : "Search team members by name or role...")
              }
              className="flex h-8 w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 outline-none border-none ring-0 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="size-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
                aria-label={isArabic ? "مسح البحث" : "Clear search"}
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Group Header */}
          <div className="px-3.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/75 border-b border-border/40 bg-muted/10 flex items-center justify-between select-none">
            <span>{isArabic ? "أعضاء الفريق" : "TEAM MEMBERS"}</span>
            <span className="text-[9px] font-mono text-muted-foreground/60">
              {filteredMembers.length} {isArabic ? "متاح" : "available"}
            </span>
          </div>

          {/* Member List */}
          <CommandPrimitive.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1.5 space-y-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border">
            {/* Unassigned Item */}
            {showUnassigned && (
              <CommandPrimitive.Item
                key="__unassigned__"
                value="__unassigned__"
                onSelect={() => handleSelect(null)}
                className={cn(
                  "group flex items-center justify-between min-h-[52px] px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border select-none",
                  !selectedMember
                    ? "bg-primary/[0.08] dark:bg-primary/[0.14] border-primary/40 dark:border-primary/50 text-foreground font-semibold shadow-2xs"
                    : "border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-8 sm:size-9 shrink-0 rounded-full bg-muted/70 border border-dashed border-border/90 flex items-center justify-center text-muted-foreground font-mono text-sm font-semibold">
                    —
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground/90 truncate block leading-snug text-xs sm:text-sm">
                      {unassignedLabel || (isArabic ? "غير معين" : "Unassigned")}
                    </span>
                    <span className="text-[11px] text-muted-foreground/75 truncate block font-normal leading-tight mt-0.5">
                      {isArabic ? "بدون مسؤول معين" : "No owner assigned"}
                    </span>
                  </div>
                </div>
                {!selectedMember && (
                  <div className="size-5 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0 ms-2">
                    <Check className="size-3.5 stroke-[2.5]" />
                  </div>
                )}
              </CommandPrimitive.Item>
            )}

            {/* Member List Items */}
            {filteredMembers.length > 0 ? (
              filteredMembers.map((m) => {
                const isSelected =
                  (selectedMember?.id && selectedMember.id === m.id) ||
                  (selectedMember?.profileId && selectedMember.profileId === m.profileId);

                return (
                  <CommandPrimitive.Item
                    key={m.id}
                    value={`${m.displayName} ${m.position || ""} ${m.role || ""}`}
                    onSelect={() => {
                      if (!m.hasProfile) {
                        toast.error(
                          isArabic
                            ? `عضو الفريق '${m.displayName}' ليس لديه حساب مستخدم نشط. يرجى إنشاء أو ربط حساب قبل تعيين المهام.`
                            : `Team member '${m.displayName}' has no active user account profile. Create/link a profile before assigning tasks.`
                        );
                        setOpen(false);
                        return;
                      }
                      handleSelect(m.profileId || m.id);
                    }}
                    className={cn(
                      "group flex items-center justify-between min-h-[52px] px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border select-none",
                      isSelected
                        ? "bg-primary/[0.08] dark:bg-primary/[0.14] border-primary/40 dark:border-primary/50 text-foreground font-semibold shadow-2xs"
                        : "border-transparent hover:bg-muted/50 dark:hover:bg-muted/40 text-foreground",
                      !m.hasProfile && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="size-8 sm:size-9 shrink-0 rounded-full border border-border/80">
                        {m.photoUrl ? <AvatarImage src={m.photoUrl} alt={m.displayName} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold font-mono">
                          {getInitials(m.displayName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="font-semibold text-foreground text-xs sm:text-sm truncate block leading-snug"
                            title={m.displayName}
                          >
                            {m.displayName}
                          </span>
                          {!m.hasProfile && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {isArabic ? "بدون حساب" : "No Account"}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[11px] text-muted-foreground truncate block font-normal leading-tight mt-0.5"
                          title={m.position || (isArabic ? "أخصائي" : "Specialist")}
                        >
                          {m.position || (isArabic ? "أخصائي" : "Specialist")}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="size-5 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0 ms-2">
                        <Check className="size-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </CommandPrimitive.Item>
                );
              })
            ) : !showUnassigned ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                <UserX className="size-6 text-muted-foreground/50 mb-1" />
                <span>
                  {isArabic
                    ? "لم يتم العثور على أعضاء مطابقين"
                    : "No matching team members found"}
                </span>
              </div>
            ) : null}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );

  // -------------------------------------------------------------------------
  // VARIANT: SUBTASK / INLINE STAGE CONTROL (SECTION 16)
  // -------------------------------------------------------------------------
  if (variant === "subtask" || variant === "compact") {
    return (
      <div
        className={cn("flex items-center gap-1.5 shrink-0", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild disabled={!isInteractive}>
            <button
              type="button"
              disabled={!isInteractive}
              className={cn(
                "group flex items-center justify-between gap-3 px-3 py-1.5 min-h-[46px] rounded-xl text-start transition-all border shadow-2xs select-none",
                isInteractive
                  ? "bg-card hover:bg-muted/40 border-border hover:border-primary/40 cursor-pointer"
                  : "bg-muted/30 border-border/70 cursor-default opacity-90",
                isUpdating && "pointer-events-none opacity-80",
                triggerClassName
              )}
              title={
                canAssign
                  ? isArabic
                    ? "تغيير المنفذ المكلف بهذه المرحلة"
                    : "Change stage assignee"
                  : undefined
              }
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar className="size-7 sm:size-8 shrink-0 rounded-full border border-border/80">
                  {selectedMember?.photoUrl ? (
                    <AvatarImage src={selectedMember.photoUrl} alt={selectedMember.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-xs font-bold font-mono">
                    {selectedMember ? getInitials(selectedMember.displayName) : "—"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <span
                    className="text-xs font-semibold text-foreground truncate block leading-snug"
                    title={selectedMember?.displayName || (isArabic ? "غير معين" : "Unassigned")}
                  >
                    {selectedMember?.displayName || (isArabic ? "غير معين" : "Unassigned")}
                  </span>
                  <span
                    className="text-[10px] text-muted-foreground truncate block font-normal leading-tight mt-0.5"
                    title={
                      selectedMember?.position ||
                      (isArabic ? "بدون مسؤول معين" : "No owner assigned")
                    }
                  >
                    {selectedMember?.position ||
                      (isArabic ? "بدون مسؤول معين" : "No owner assigned")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ms-2">
                {isUpdating ? (
                  <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                ) : canAssign && !disabled ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all flex items-center gap-1">
                    <span>{isArabic ? "تغيير" : "CHANGE"}</span>
                    <ChevronDown className="size-2.5 shrink-0 group-hover:rotate-180 transition-transform duration-200" />
                  </span>
                ) : null}
              </div>
            </button>
          </PopoverPrimitive.Trigger>

          {isInteractive && popoverContent}
        </PopoverPrimitive.Root>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VARIANT: FORM FIELD (SECTION 15)
  // -------------------------------------------------------------------------
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
          {label}
        </label>
      )}

      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild disabled={!isInteractive}>
          <button
            type="button"
            disabled={!isInteractive}
            className={cn(
              "flex items-center justify-between gap-3 w-full p-2.5 min-h-[50px] rounded-2xl text-start transition-all shadow-xs group border select-none",
              selectedMember
                ? "bg-card hover:bg-muted/40 border-border hover:border-primary/40 cursor-pointer"
                : "bg-muted/20 hover:bg-muted/50 border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground cursor-pointer",
              isUpdating && "pointer-events-none opacity-80",
              triggerClassName
            )}
          >
            {selectedMember ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="size-8 shrink-0 rounded-full border border-primary/25">
                  {selectedMember.photoUrl ? (
                    <AvatarImage src={selectedMember.photoUrl} alt={selectedMember.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold font-mono">
                    {getInitials(selectedMember.displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="text-xs font-semibold text-foreground truncate block leading-snug"
                      title={selectedMember.displayName}
                    >
                      {selectedMember.displayName}
                    </span>
                    {!selectedMember.hasProfile && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                        {isArabic ? "بدون حساب" : "No Account"}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] text-muted-foreground truncate block font-normal leading-tight mt-0.5"
                    title={selectedMember.position || (isArabic ? "عضو فريق" : "SADA Member")}
                  >
                    {selectedMember.position || (isArabic ? "عضو فريق" : "SADA Member")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0 flex-1">
                <div className="size-8 rounded-full bg-muted/80 border border-dashed border-border/80 grid place-items-center shrink-0">
                  <User className="size-4 text-muted-foreground/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground/85 truncate block">
                    {placeholder || (isArabic ? "تعيين عضو من الفريق" : "Assign a team member")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 truncate block">
                    {unassignedLabel || (isArabic ? "غير معين" : "Unassigned")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 shrink-0 ms-2">
              {isUpdating ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-transform duration-200" />
              )}
            </div>
          </button>
        </PopoverPrimitive.Trigger>

        {isInteractive && popoverContent}
      </PopoverPrimitive.Root>
    </div>
  );
}

/** Backward compatibility alias for TaskModal */
export function MemberPicker(props: {
  value?: string | null;
  onChange?: (id: string) => void;
  profiles: ProfileRow[];
  teamMembers?: TeamMemberRow[];
  label?: string;
  placeholder?: string;
  unassignedLabel?: string;
  disabled?: boolean;
  canAssign?: boolean;
  isUpdating?: boolean;
  className?: string;
}) {
  return (
    <TeamMemberPicker
      variant="form"
      value={props.value}
      onChange={(newId) => props.onChange?.(newId || "")}
      profiles={props.profiles}
      teamMembers={props.teamMembers}
      label={props.label}
      placeholder={props.placeholder}
      unassignedLabel={props.unassignedLabel}
      disabled={props.disabled}
      canAssign={props.canAssign}
      isUpdating={props.isUpdating}
      className={props.className}
    />
  );
}

/** Backward compatibility wrapper for SubtaskAssigneePopover */
export function SubtaskAssigneePopover(props: {
  subtask: TaskRow;
  teamMembers: TeamMemberRow[];
  profiles: ProfileRow[];
  canAssign: boolean;
  isUpdating: boolean;
  onAssignChange: (newAssigneeId: string | null) => void;
  isAr: boolean;
}) {
  return (
    <TeamMemberPicker
      variant="subtask"
      subtask={props.subtask}
      teamMembers={props.teamMembers}
      profiles={props.profiles}
      canAssign={props.canAssign}
      isUpdating={props.isUpdating}
      onAssignChange={props.onAssignChange}
      isAr={props.isAr}
    />
  );
}
