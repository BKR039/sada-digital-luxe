import {
  format, isPast, isToday, isTomorrow, isSameDay, parseISO, isValid,
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addQuarters, subQuarters,
  isWithinInterval, differenceInDays
} from "date-fns";
import { formatDate } from "@/lib/date-locale";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Pause, XCircle,
  Eye, AlertCircle, GripVertical, User, Sparkles
} from "lucide-react";

// ---------------------------------------------------------------------------
// Shared helpers for project tasks UI — SADA WORK OS
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "revision"
  | "approved"
  | "delivered"
  | "blocked"
  | "done"
  | "postponed"
  | "paused"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskRow {
  id: string;
  project_id: string;
  client_id?: string | null;
  package_id?: string | null;
  deliverable_id?: string | null;
  reviewer_id?: string | null;
  parent_task_id?: string | null;
  commitment_id?: string | null;
  occurrence_date?: string | null;
  sequence_index?: number | null;
  scheduled_date?: string | null;
  idempotency_key?: string | null;
  delivery_period?: string | null;
  source_type?: "manual" | "recurring_schedule" | "package_reconciliation" | "workflow" | null;
  is_reconciliation_managed?: boolean | null;
  manual_override?: boolean | null;
  cancelled_reason?: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  assigned_by_id?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  completed_by?: string | null;
  category: string | null;
  service: string | null;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  deadline_alert_enabled?: boolean | null;
  deadline_alert_days?: number | null;
  deadline_alert_message?: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  labor_cost?: number | null;
  attachments?: any[];
  revision_count?: number | null;
  notes: string | null;
  postpone_reason: string | null;
  result_title: string | null;
  result_links: string[];
  result_notes: string | null;
  previous_assignee_id: string | null;
  handoff_reason: string | null;
  waiting_on: string | null;
  blocked_reason: string | null;
  is_stage_locked?: boolean | null;
  drive_url?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  published_urls?: string[] | null;
  target_platforms?: string[] | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskHandoffRow {
  id: string;
  task_id: string;
  project_id: string;
  requested_by_id: string;
  from_assignee_id: string;
  to_assignee_id: string;
  assigner_id: string;
  request_reason: string;
  new_assignee_accepted_at: string | null;
  assigner_approved_at: string | null;
  rejected_at: string | null;
  rejected_by_id: string | null;
  rejection_reason: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

export type TaskVisualState =
  | "completed"
  | "overdue"
  | "deadline_today"
  | "urgent"
  | "approaching"
  | "active"
  | "future";

/**
 * Checks if a task is active on a given calendar day.
 * - If task has start_date AND deadline: returns true if day is within [start_date, deadline]
 * - If task has only deadline: returns true if day is on deadline
 * - If task has only start_date: returns true if day is on start_date
 */
export function isTaskActiveOnDay(task: TaskRow, day: Date): boolean {
  const targetDayStart = startOfDay(day);
  const targetDayEnd = endOfDay(day);

  if (task.start_date && task.deadline) {
    const start = startOfDay(parseISO(task.start_date));
    const end = endOfDay(parseISO(task.deadline));
    return isWithinInterval(targetDayStart, { start, end });
  }

  if (task.deadline) {
    const deadlineDay = startOfDay(parseISO(task.deadline));
    return isSameDay(targetDayStart, deadlineDay);
  }

  if (task.start_date) {
    const startDay = startOfDay(parseISO(task.start_date));
    return isSameDay(targetDayStart, startDay);
  }

  return false;
}

/**
 * Deterministic visual state calculator from deadline, current date, start date, and status.
 */
export function computeTaskVisualState(task: TaskRow, refDate: Date = new Date()): TaskVisualState {
  if (task.status === "done" || task.status === "delivered" || task.status === "approved") return "completed";
  if (isTaskOverdue(task, refDate)) return "overdue";

  if (task.deadline) {
    const dlDate = parseISO(task.deadline);
    const todayStart = startOfDay(refDate);
    const dlStart = startOfDay(dlDate);

    if (isSameDay(todayStart, dlStart)) return "deadline_today";

    const daysRemaining = differenceInDays(dlStart, todayStart);
    if (daysRemaining > 0 && daysRemaining <= 2) return "urgent";

    const alertThreshold = task.deadline_alert_enabled && task.deadline_alert_days != null
      ? task.deadline_alert_days
      : 3;
    if (daysRemaining > 0 && daysRemaining <= alertThreshold) return "approaching";
  }

  if (task.start_date) {
    const startDate = parseISO(task.start_date);
    if (startDate > refDate && !isSameDay(startDate, refDate)) {
      return "future";
    }
  }

  return "active";
}

/**
 * Multi-day range helpers for calendar visualization.
 */
export function isTaskStartDay(task: TaskRow, day: Date): boolean {
  if (!task.start_date) return false;
  return isSameDay(startOfDay(parseISO(task.start_date)), startOfDay(day));
}

export function isTaskDeadlineDay(task: TaskRow, day: Date): boolean {
  if (!task.deadline) return false;
  return isSameDay(startOfDay(parseISO(task.deadline)), startOfDay(day));
}

export function getTaskWorkRangeSummary(task: TaskRow): string {
  const startStr = task.start_date ? format(parseISO(task.start_date), "d MMM") : "";
  const endStr = task.deadline ? format(parseISO(task.deadline), "d MMM") : "";
  if (startStr && endStr) return `${startStr} → ${endStr}`;
  if (endStr) return `Due ${endStr}`;
  if (startStr) return `Starts ${startStr}`;
  return "";
}

/**
 * Deterministic alert badge & message resolver for tasks.
 */
export function getTaskAlertBadge(task: TaskRow, refDate: Date = new Date()): {
  show: boolean;
  text: string;
  severity: "critical" | "urgent" | "amber" | "neutral" | "completed";
} | null {
  if (task.status === "done") {
    return { show: true, text: "Delivered", severity: "completed" };
  }

  if (isTaskOverdue(task, refDate)) {
    if (task.deadline) {
      const daysOverdue = Math.max(1, differenceInDays(startOfDay(refDate), startOfDay(parseISO(task.deadline))));
      return {
        show: true,
        text: daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`,
        severity: "critical",
      };
    }
    return { show: true, text: "Overdue", severity: "critical" };
  }

  if (!task.deadline) return null;

  const dlDate = parseISO(task.deadline);
  const todayStart = startOfDay(refDate);
  const dlStart = startOfDay(dlDate);

  const alertDays = task.deadline_alert_enabled && task.deadline_alert_days != null
    ? task.deadline_alert_days
    : 3;

  if (isSameDay(todayStart, dlStart)) {
    return {
      show: true,
      text: (task.deadline_alert_enabled && task.deadline_alert_message) || "Due today",
      severity: "critical",
    };
  }

  const daysRemaining = differenceInDays(dlStart, todayStart);

  if (daysRemaining === 1) {
    return {
      show: true,
      text: (task.deadline_alert_enabled && task.deadline_alert_message) || "Deadline tomorrow",
      severity: "urgent",
    };
  }

  if (daysRemaining === 2) {
    return {
      show: true,
      text: (task.deadline_alert_enabled && task.deadline_alert_message) || "2 days left",
      severity: "urgent",
    };
  }

  // Active alert within threshold (<= alertDays)
  if (daysRemaining > 0 && daysRemaining <= alertDays) {
    return {
      show: true,
      text: (task.deadline_alert_enabled && task.deadline_alert_message) || `${daysRemaining} days left`,
      severity: "amber",
    };
  }

  // Future / Normal window (> alertDays)
  if (daysRemaining > alertDays) {
    return {
      show: true,
      text: `${daysRemaining} days left`,
      severity: "neutral",
    };
  }

  return null;
}

export interface ProjectRow {
  id: string;
  title: string;
  client_name: string;
  status: string;
  description: string | null;
  business_type: string | null;
  goals: string | null;
  problems: string | null;
  requested_services: string[];
  provided_services?: string[];
  timeline: string | null;
  budget: string | null;
  original_message: string | null;
  questionnaire_answers: any;
  contact_submission_id: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  start_date: string | null;
  deadline: string | null;
  last_contact_date?: string | null;
  last_contact_by?: string | null;
  next_followup_date?: string | null;
  followup_owner_id?: string | null;
  followup_status?: "no_followup" | "followup_due" | "waiting_for_client" | "waiting_for_sada" | "followup_completed" | null;
  followup_summary?: string | null;
  followup_next_action?: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientStatus = "prospect" | "active" | "inactive" | "archived";
export type ClientType = "monthly" | "one_off";

export interface PackageConfig {
  reels_quota?: number;
  posts_quota?: number;
  stories_quota?: number;
  other_services?: string[];
  [key: string]: any;
}

export interface ClientRow {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_channel?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
  status: ClientStatus;
  client_type?: ClientType;
  package_id?: string | null;
  package_name?: string | null;
  package_config?: PackageConfig | null;
  billing_start_date?: string | null;
  current_period_month?: string | null;
  relationship_owner_id?: string | null;
  account_manager_id?: string | null;
  sales_owner_id?: string | null;
  commission_recipient_id?: string | null;
  monthly_package_price?: number | null;
  default_service_fee?: number | null;
  default_sponsoring_budget?: number | null;
  commission_rate?: number | null;
  created_at: string;
  updated_at: string;
}

export function formatPeriodMonth(periodStr?: string | null): string {
  const isRtl = typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar");
  if (!periodStr) return isRtl ? "الفترة الحالية" : "Current Period";
  if (/^\d{4}-\d{2}$/.test(periodStr)) {
    const [year, month] = periodStr.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return formatDate(date, "MMMM yyyy");
  }
  return periodStr;
}

export function computeMonthlyProgress(
  deliverables: TaskRow[],
  packageConfig?: PackageConfig | null
) {
  const reelsQuota = packageConfig?.reels_quota || 0;
  const postsQuota = packageConfig?.posts_quota || 0;
  const storiesQuota = packageConfig?.stories_quota || 0;

  // Primary deliverables are top-level tasks (parent_task_id is null or undefined)
  const topDeliverables = deliverables.filter((t) => !t.parent_task_id);

  const reels = topDeliverables.filter(
    (t) => (t.category && t.category.toLowerCase().includes("reel")) || (t.title && t.title.toLowerCase().startsWith("reel"))
  );
  const posts = topDeliverables.filter(
    (t) => (t.category && t.category.toLowerCase().includes("post")) || (t.title && t.title.toLowerCase().startsWith("post"))
  );
  const stories = topDeliverables.filter(
    (t) => (t.category && t.category.toLowerCase().includes("story")) || (t.title && t.title.toLowerCase().startsWith("story"))
  );

  const reelsDone = reels.filter((t) => t.status === "done").length;
  const postsDone = posts.filter((t) => t.status === "done").length;
  const storiesDone = stories.filter((t) => t.status === "done").length;

  const totalQuota = (reelsQuota || reels.length) + (postsQuota || posts.length) + (storiesQuota || stories.length);
  const totalDone = reelsDone + postsDone + storiesDone;

  const hasBlocked = topDeliverables.some((t) => t.status === "blocked");
  const hasUrgentPending = topDeliverables.some(
    (t) => t.priority === "urgent" && t.status !== "done"
  );

  let attentionState: "on_track" | "attention" | "completed" = "on_track";
  if (totalQuota > 0 && totalDone >= totalQuota) {
    attentionState = "completed";
  } else if (hasBlocked || hasUrgentPending) {
    attentionState = "attention";
  }

  return {
    reels: { done: reelsDone, quota: reelsQuota || reels.length, items: reels },
    posts: { done: postsDone, quota: postsQuota || posts.length, items: posts },
    stories: { done: storiesDone, quota: storiesQuota || stories.length, items: stories },
    totalDone,
    totalQuota,
    percent: totalQuota > 0 ? Math.round((totalDone / totalQuota) * 100) : 0,
    attentionState,
  };
}

export const CLIENT_STATUS_CONFIG: Record<ClientStatus, { label: string; bg: string; color: string; border: string }> = {
  active: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "نشط"
        : "Active";
    },
    bg: "bg-emerald-500/10",
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20"
  },
  prospect: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "محتمل"
        : "Prospect";
    },
    bg: "bg-blue-500/10",
    color: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20"
  },
  inactive: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "غير نشط"
        : "Inactive";
    },
    bg: "bg-muted",
    color: "text-muted-foreground",
    border: "border-border"
  },
  archived: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "مؤرشف"
        : "Archived";
    },
    bg: "bg-zinc-500/10",
    color: "text-zinc-500",
    border: "border-zinc-500/20"
  },
};

/**
 * Normalizes email: trims and converts to lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes phone number: trims whitespace, collapses formatting, preserves country code if present.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Deterministic candidate matching for existing clients.
 * Hierarchy:
 * 1. Exact normalized email
 * 2. Exact normalized phone
 * 3. Exact normalized business name / client name
 */
export function findMatchingClients(
  criteria: {
    email?: string | null;
    phone?: string | null;
    business_name?: string | null;
    name?: string | null;
  },
  existingClients: ClientRow[]
): ClientRow[] {
  const normEmail = normalizeEmail(criteria.email);
  const normPhone = normalizePhone(criteria.phone);
  const normBiz = criteria.business_name?.trim().toLowerCase() || null;
  const normName = criteria.name?.trim().toLowerCase() || null;

  const matches = new Set<ClientRow>();

  for (const client of existingClients) {
    const cEmail = normalizeEmail(client.email);
    const cPhone = normalizePhone(client.phone);
    const cName = client.name.trim().toLowerCase();

    // 1. Exact email match
    if (normEmail && cEmail && normEmail === cEmail) {
      matches.add(client);
      continue;
    }

    // 2. Exact phone match
    if (normPhone && cPhone && (normPhone === cPhone || normPhone.endsWith(cPhone) || cPhone.endsWith(normPhone))) {
      matches.add(client);
      continue;
    }

    // 3. Exact business name match
    if (normBiz && normBiz === cName) {
      matches.add(client);
      continue;
    }

    // 4. Exact contact name match if business is empty
    if (!normBiz && normName && normName === cName) {
      matches.add(client);
      continue;
    }
  }

  return Array.from(matches);
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
}

export interface TeamMemberRow {
  id: string;
  profile_id?: string | null;
  name: string;
  position: string;
  position_ar?: string | null;
  division: string;
  specialties: string[];
  email?: string | null;
  bio?: string | null;
  bio_ar?: string | null;
  photo_url?: string | null;
  socials?: Record<string, string> | null;
  sort_order: number;
  published: boolean;
  is_active: boolean;
  availability_status: "available" | "busy" | "overloaded" | "on_leave";
  role?: "super_admin" | "admin" | "worker" | string | null;
  employment_type?: "full_time" | "part_time" | "freelance" | "intern" | string | null;
  created_at?: string;
  updated_at?: string;
  display_name?: string | null;
}

export interface ClientCommunicationLog {
  id: string;
  project_id: string;
  contact_method: "WhatsApp" | "Phone" | "Email" | "Meeting" | "Other";
  team_member_id: string | null;
  summary: string;
  next_action: string | null;
  next_followup_date: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Team Member Identity & Foreign Key Resolver Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves any ID (team_members.id or profiles.id) to a valid profile_id (profiles.id).
 * Guarantees that only valid profiles.id values are saved to project_tasks FK columns.
 *
 * SAFETY: Never returns an ID that hasn't been verified against profiles or team_members.
 * If the ID can't be resolved, returns null rather than passing through an unvalidated UUID.
 */
export function resolveToProfileId(
  idOrProfileId: string | null | undefined,
  teamMembers?: TeamMemberRow[],
  profiles?: ProfileRow[]
): string | null {
  if (!idOrProfileId) return null;

  // 1. Direct match in profiles — this is the most common and safest path
  if (profiles && profiles.length > 0) {
    const directProfile = profiles.find((p) => p.id === idOrProfileId);
    if (directProfile) return directProfile.id;
  }

  // 2. Match in teamMembers
  if (teamMembers && teamMembers.length > 0) {
    // Check if the ID matches a team_member.profile_id
    const memberByProfile = teamMembers.find((m) => m.profile_id === idOrProfileId);
    if (memberByProfile && memberByProfile.profile_id) return memberByProfile.profile_id;

    // Check if the ID matches a team_member.id → return their profile_id (or null if unlinked)
    const memberById = teamMembers.find((m) => m.id === idOrProfileId);
    if (memberById) {
      return memberById.profile_id || null;
    }
  }

  // 3. If profiles/teamMembers haven't loaded yet (empty arrays), we can't validate.
  //    Return the ID as-is ONLY if no data is available to validate against.
  //    This handles the initial render before data loads (useState initialization).
  if ((!profiles || profiles.length === 0) && (!teamMembers || teamMembers.length === 0)) {
    return idOrProfileId;
  }

  // 4. ID not found in any loaded dataset — return null to prevent FK violations
  console.warn(
    `[resolveToProfileId] ID "${idOrProfileId}" not found in profiles (${profiles?.length || 0}) or team_members (${teamMembers?.length || 0}). Returning null to prevent FK violation.`
  );
  return null;
}

/**
 * Resolves an ID (which may be a team_member.id, a profile_id, or an auth user ID)
 * to a verified team_members.id.
 *
 * Used for foreign keys that reference public.team_members(id), such as:
 * - clients.commission_recipient_id
 * - deals.commission_recipient_id
 * - sales_commissions.team_member_id
 *
 * SAFETY: Never returns an ID that hasn't been verified against team_members.
 * Returns null if the member cannot be found.
 */
export function resolveToTeamMemberId(
  idOrProfileId: string | null | undefined,
  teamMembers?: TeamMemberRow[]
): string | null {
  if (!idOrProfileId) return null;

  if (teamMembers && teamMembers.length > 0) {
    // 1. Direct match on team_member.id (primary key)
    const directMember = teamMembers.find((m) => m.id === idOrProfileId);
    if (directMember) return directMember.id;

    // 2. Match on team_member.profile_id or user_id
    const memberByProfile = teamMembers.find(
      (m) => m.profile_id === idOrProfileId || (m as any).user_id === idOrProfileId
    );
    if (memberByProfile) return memberByProfile.id;
  }

  return null;
}

/**
 * Formats database errors into user-friendly messages for client operations,
 * avoiding exposing raw PostgreSQL foreign key constraint names.
 */
export function formatClientErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const msg = typeof err === "string" ? err : err.message || "";
  if (msg.includes("clients_commission_recipient_id_fkey")) {
    return "Selected Sales Owner is no longer available. Please select an active team member.";
  }
  if (msg.includes("clients_account_manager_id_fkey") || msg.includes("clients_sales_owner_id_fkey")) {
    return "Selected team member account is no longer active. Please select an active team member.";
  }
  if (msg.includes("clients_package_id_fkey")) {
    return "Selected service package is no longer available.";
  }
  if (msg.includes("clients_relationship_owner_id_fkey")) {
    return "Selected relationship owner is no longer active.";
  }
  return msg || "Operation failed. Please try again.";
}

/**
 * Returns the current period month in YYYY-MM format (e.g. "2026-10").
 * Used as dynamic fallback when current_period_month is not set on a client or deliverable.
 */
export function getCurrentPeriodMonth(date: Date = new Date()): string {
  return format(date, "yyyy-MM");
}

/**
 * Resolves member display info for task assignment (assignee_id, assigned_by_id).
 */
export function getAssignmentMemberInfo(
  profileId: string | null | undefined,
  teamMembers?: TeamMemberRow[],
  profiles?: ProfileRow[]
): {
  id: string | null;
  displayName: string;
  name: string;
  position?: string;
  photoUrl?: string | null;
  hasProfile: boolean;
  role?: string | null;
} | null {
  if (!profileId) return null;

  if (teamMembers) {
    const member = teamMembers.find((m) => m.profile_id === profileId || m.id === profileId);
    if (member) {
      return {
        id: member.profile_id || null,
        displayName: member.display_name || member.name,
        name: member.name,
        position: member.position,
        photoUrl: member.photo_url,
        hasProfile: !!member.profile_id,
        role: member.role || "worker",
      };
    }
  }

  if (profiles) {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      return {
        id: profile.id,
        displayName: profile.display_name || "Team Member",
        name: profile.display_name || "Team Member",
        position: "Specialist",
        photoUrl: null,
        hasProfile: true,
        role: "worker",
      };
    }
  }

  return null;
}


// Status styling -----------------------------------------------------------

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string; Icon: typeof Circle }> = {
  todo: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "قيد الانتظار"
        : "To Do";
    },
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    Icon: Circle
  },
  in_progress: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "قيد التنفيذ"
        : "In Progress";
    },
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    Icon: Clock
  },
  review: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "قيد المراجعة"
        : "Review";
    },
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    Icon: Eye
  },
  revision: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "قيد التعديل"
        : "Revision";
    },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    Icon: Clock
  },
  approved: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "معتمد"
        : "Approved";
    },
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    Icon: CheckCircle2
  },
  delivered: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "تم التسليم"
        : "Delivered";
    },
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    Icon: CheckCircle2
  },
  blocked: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "متوقفة"
        : "Blocked";
    },
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    Icon: AlertCircle
  },
  done: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "مكتملة"
        : "Done";
    },
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    Icon: CheckCircle2
  },
  postponed: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "مؤجلة"
        : "Postponed";
    },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    Icon: Pause
  },
  paused: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "موقوفة مؤقتاً"
        : "Paused";
    },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    Icon: Pause
  },
  cancelled: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "ملغاة"
        : "Cancelled";
    },
    color: "text-muted-foreground/60",
    bg: "bg-muted/50",
    border: "border-border/50",
    Icon: XCircle
  },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; dot: string }> = {
  low: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "منخفضة"
        : "Low";
    },
    color: "text-muted-foreground",
    bg: "bg-muted",
    dot: "bg-muted-foreground"
  },
  medium: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "متوسطة"
        : "Medium";
    },
    color: "text-primary",
    bg: "bg-primary/10",
    dot: "bg-primary"
  },
  high: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "عالية"
        : "High";
    },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    dot: "bg-amber-500"
  },
  urgent: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "عاجلة"
        : "Urgent";
    },
    color: "text-destructive",
    bg: "bg-destructive/10",
    dot: "bg-destructive"
  },
};

export const PROJECT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "نشط"
        : "Active";
    },
    color: "text-primary",
    bg: "bg-primary/10"
  },
  completed: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "مكتمل"
        : "Completed";
    },
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10"
  },
  on_hold: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "معلق"
        : "On Hold";
    },
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10"
  },
  cancelled: {
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "ملغى"
        : "Cancelled";
    },
    color: "text-muted-foreground",
    bg: "bg-muted"
  },
};

// ---------------------------------------------------------------------------
// Project Health (Deterministic — zero external AI)
// ---------------------------------------------------------------------------

export type ProjectHealth = "on_track" | "at_risk" | "overdue" | "on_hold" | "completed";

export interface ProjectHealthInfo {
  health: ProjectHealth;
  label: string;
  color: string;
  bg: string;
  border: string;
  reason: string;
}

export function computeProjectHealth(project: ProjectRow, tasks: TaskRow[]): ProjectHealthInfo {
  if (project.status === "completed") {
    return {
      health: "completed",
      label: "COMPLETED",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      reason: "All deliverables completed",
    };
  }
  if (project.status === "on_hold") {
    return {
      health: "on_hold",
      label: "ON HOLD",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      reason: "Project paused",
    };
  }

  const progress = computeProgress(tasks);
  const overdueTasks = tasks.filter(t => isTaskOverdue(t));
  const blockedTasks = tasks.filter(t => t.status === "blocked");
  const now = new Date();

  // Overdue check
  const isProjectDeadlineOverdue = project.deadline
    ? (project.deadline.includes("T") ? isPast(parseISO(project.deadline)) : isPast(endOfDay(parseISO(project.deadline))))
    : false;

  if (isProjectDeadlineOverdue) {
    return {
      health: "overdue",
      label: "OVERDUE",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      reason: "Project deadline has passed",
    };
  }

  if (overdueTasks.length >= 2) {
    return {
      health: "overdue",
      label: "OVERDUE",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      reason: `${overdueTasks.length} tasks overdue`,
    };
  }

  // At Risk conditions
  if (overdueTasks.length === 1) {
    return {
      health: "at_risk",
      label: "AT RISK",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      reason: `1 task overdue (${overdueTasks[0].title})`,
    };
  }

  if (blockedTasks.length > 0) {
    const reason = blockedTasks[0].waiting_on === "client" ? "Waiting on client" : "Blocked task in progress";
    return {
      health: "at_risk",
      label: "AT RISK",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      reason,
    };
  }

  if (project.deadline) {
    const dl = new Date(project.deadline + "T23:59:59");
    const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 5 && progress.percent < 60) {
      return {
        health: "at_risk",
        label: "AT RISK",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        reason: `${diff} day${diff === 1 ? "" : "s"} left with ${progress.percent}% done`,
      };
    }
  }

  return {
    health: "on_track",
    label: "ON TRACK",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    reason: "On schedule",
  };
}

export interface ProjectNextAction {
  type: "task" | "followup" | "none";
  title: string;
  subtitle?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  deadline?: string | null;
  taskId?: string;
  task?: TaskRow;
  badgeLabel?: string;
  badgeColor?: string;
}

export function computeNextAction(project: ProjectRow, tasks: TaskRow[]): ProjectNextAction {
  const activeTasks = tasks.filter(t => t.status !== "done" && t.status !== "cancelled");

  // 1. Overdue urgent task
  const overdueUrgent = activeTasks.find(t => isTaskOverdue(t) && t.priority === "urgent");
  if (overdueUrgent) {
    return {
      type: "task",
      title: overdueUrgent.title,
      subtitle: "Overdue Urgent Task",
      assigneeId: overdueUrgent.assignee_id,
      priority: overdueUrgent.priority,
      deadline: overdueUrgent.deadline,
      taskId: overdueUrgent.id,
      task: overdueUrgent,
      badgeLabel: "OVERDUE URGENT",
      badgeColor: "text-destructive bg-destructive/10 border-destructive/30",
    };
  }

  // 2. Overdue high priority task
  const overdueHigh = activeTasks.find(t => isTaskOverdue(t) && t.priority === "high");
  if (overdueHigh) {
    return {
      type: "task",
      title: overdueHigh.title,
      subtitle: "Overdue High Priority Task",
      assigneeId: overdueHigh.assignee_id,
      priority: overdueHigh.priority,
      deadline: overdueHigh.deadline,
      taskId: overdueHigh.id,
      task: overdueHigh,
      badgeLabel: "OVERDUE HIGH",
      badgeColor: "text-destructive bg-destructive/10 border-destructive/30",
    };
  }

  // 3. Blocked task requiring action
  const blockedTask = activeTasks.find(t => t.status === "blocked");
  if (blockedTask) {
    return {
      type: "task",
      title: blockedTask.title,
      subtitle: blockedTask.waiting_on === "client" ? "Blocked — Waiting on Client" : "Blocked — Waiting on Team",
      assigneeId: blockedTask.assignee_id,
      priority: blockedTask.priority,
      deadline: blockedTask.deadline,
      taskId: blockedTask.id,
      task: blockedTask,
      badgeLabel: "BLOCKED",
      badgeColor: "text-rose-600 bg-rose-500/10 border-rose-500/30",
    };
  }

  // 4. Task due today
  const dueTodayTask = activeTasks.find(t => t.deadline && isToday(parseISO(t.deadline)));
  if (dueTodayTask) {
    return {
      type: "task",
      title: dueTodayTask.title,
      subtitle: "Due Today",
      assigneeId: dueTodayTask.assignee_id,
      priority: dueTodayTask.priority,
      deadline: dueTodayTask.deadline,
      taskId: dueTodayTask.id,
      task: dueTodayTask,
      badgeLabel: "DUE TODAY",
      badgeColor: "text-amber-600 bg-amber-500/10 border-amber-500/30",
    };
  }

  // 5. Next upcoming task (sorted by deadline/created_at)
  const upcomingTasks = [...activeTasks].sort((a, b) => {
    const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return aTime - bTime;
  });
  if (upcomingTasks.length > 0) {
    const nextTask = upcomingTasks[0];
    return {
      type: "task",
      title: nextTask.title,
      subtitle: nextTask.status === "in_progress" ? "In Progress" : "Next Upcoming Task",
      assigneeId: nextTask.assignee_id,
      priority: nextTask.priority,
      deadline: nextTask.deadline,
      taskId: nextTask.id,
      task: nextTask,
      badgeLabel: "NEXT TASK",
      badgeColor: "text-primary bg-primary/10 border-primary/30",
    };
  }

  // 6. Client follow-up due
  if (project.next_followup_date || project.followup_status === "followup_due") {
    const isDue = project.followup_status === "followup_due" || (project.next_followup_date && isPast(parseISO(project.next_followup_date)));
    if (isDue) {
      return {
        type: "followup",
        title: project.followup_next_action || `Follow up with ${project.client_name}`,
        subtitle: `Follow-up Due (${project.client_name})`,
        assigneeId: project.followup_owner_id,
        badgeLabel: "FOLLOW-UP DUE",
        badgeColor: "text-amber-600 bg-amber-500/10 border-amber-500/30",
      };
    }
  }

  // 7. None
  return {
    type: "none",
    title: "No immediate action required",
    subtitle: "All tasks and follow-ups are up to date.",
    badgeLabel: "ALL CLEAR",
    badgeColor: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  };
}

// ---------------------------------------------------------------------------
// Typical Phases
// ---------------------------------------------------------------------------

export const TYPICAL_PHASES = [
  "Discovery",
  "Strategy",
  "Planning",
  "Design",
  "Production",
  "Development",
  "Review",
  "Revisions",
  "Launch",
  "Delivery",
] as const;

// ---------------------------------------------------------------------------
// Period & Range Navigation
// ---------------------------------------------------------------------------

export type PeriodKey =
  | "today"
  | "this_week"
  | "this_month"
  | "next_month"
  | "this_quarter"
  | "custom"
  | "all_time";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  {
    key: "today",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "اليوم"
        : "Today";
    }
  },
  {
    key: "this_week",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "هذا الأسبوع"
        : "This Week";
    }
  },
  {
    key: "this_month",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "هذا الشهر"
        : "This Month";
    }
  },
  {
    key: "next_month",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "الشهر القادم"
        : "Next Month";
    }
  },
  {
    key: "this_quarter",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "هذا الربع"
        : "This Quarter";
    }
  },
  {
    key: "custom",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "نطاق مخصص"
        : "Custom Range";
    }
  },
  {
    key: "all_time",
    get label() {
      return typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar")
        ? "كل الفترات"
        : "All Time";
    }
  },
];

export function getPeriodRange(
  periodKey: PeriodKey,
  anchorDate: Date,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date; label: string } {
  const isRtl = typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar");
  switch (periodKey) {
    case "today":
      return {
        start: startOfDay(anchorDate),
        end: endOfDay(anchorDate),
        label: formatDate(anchorDate, "EEEE, d MMMM yyyy"),
      };
    case "this_week": {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
      const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `${formatDate(start, "d MMM")} – ${formatDate(end, "d MMM yyyy")}`,
      };
    }
    case "this_month": {
      const start = startOfMonth(anchorDate);
      const end = endOfMonth(anchorDate);
      return {
        start,
        end,
        label: formatDate(anchorDate, "MMMM yyyy"),
      };
    }
    case "next_month": {
      const nm = addMonths(anchorDate, 1);
      const start = startOfMonth(nm);
      const end = endOfMonth(nm);
      return {
        start,
        end,
        label: formatDate(nm, "MMMM yyyy"),
      };
    }
    case "this_quarter": {
      const start = startOfQuarter(anchorDate);
      const end = endOfQuarter(anchorDate);
      const q = Math.floor(anchorDate.getMonth() / 3) + 1;
      return {
        start,
        end,
        label: isRtl
          ? `الربع ${q} ${formatDate(anchorDate, "yyyy")} (${formatDate(start, "d MMM")} – ${formatDate(end, "d MMM")})`
          : `Q${q} ${formatDate(anchorDate, "yyyy")} (${formatDate(start, "d MMM")} – ${formatDate(end, "d MMM")})`,
      };
    }
    case "custom": {
      const start = customStart ? startOfDay(parseISO(customStart)) : startOfMonth(anchorDate);
      const end = customEnd ? endOfDay(parseISO(customEnd)) : endOfMonth(anchorDate);
      return {
        start,
        end,
        label: `${formatDate(start, "d MMM yyyy")} – ${formatDate(end, "d MMM yyyy")}`,
      };
    }
    case "all_time":
      return {
        start: new Date(2020, 0, 1),
        end: new Date(2040, 11, 31),
        label: isRtl ? "جميع المشاريع" : "All Projects",
      };
  }
}

export function stepPeriod(periodKey: PeriodKey, anchorDate: Date, dir: -1 | 1): Date {
  switch (periodKey) {
    case "today":
      return dir === 1 ? addDays(anchorDate, 1) : subDays(anchorDate, 1);
    case "this_week":
      return dir === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1);
    case "this_month":
    case "next_month":
      return dir === 1 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1);
    case "this_quarter":
      return dir === 1 ? addQuarters(anchorDate, 1) : subQuarters(anchorDate, 1);
    default:
      return dir === 1 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1);
  }
}

export function isProjectInPeriod(
  project: ProjectRow,
  periodKey: PeriodKey,
  periodStart: Date,
  periodEnd: Date
): boolean {
  if (periodKey === "all_time") return true;

  // If project has start_date and deadline
  const pStart = project.start_date ? parseISO(project.start_date) : parseISO(project.created_at);
  const pEnd = project.deadline ? parseISO(project.deadline) : pStart;

  // Check date range overlap:
  // Overlaps if project start <= periodEnd AND project end >= periodStart
  const startWithin = pStart <= periodEnd;
  const endWithin = pEnd >= periodStart;
  const overlaps = startWithin && endWithin;

  if (overlaps) return true;

  // If project is active and updated recently, it's relevant
  if (project.status === "active") {
    const updated = parseISO(project.updated_at);
    if (isWithinInterval(updated, { start: periodStart, end: periodEnd })) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Service Division Classifier
// ---------------------------------------------------------------------------

export function getServiceDivision(serviceName: string): "Marketing" | "Development" | "Production" {
  const s = serviceName.toLowerCase();
  if (
    s.includes("dev") ||
    s.includes("web") ||
    s.includes("ui") ||
    s.includes("ux") ||
    s.includes("site") ||
    s.includes("code") ||
    s.includes("automation") ||
    s.includes("ai")
  ) {
    return "Development";
  }
  if (
    s.includes("photo") ||
    s.includes("video") ||
    s.includes("reel") ||
    s.includes("shoot") ||
    s.includes("commercial") ||
    s.includes("production")
  ) {
    return "Production";
  }
  return "Marketing";
}

// ---------------------------------------------------------------------------
// Project Period Days Calculator
// ---------------------------------------------------------------------------

export function getProjectPeriodStats(project: ProjectRow): {
  durationDays: number | null;
  daysRemaining: number | null;
  daysOverdue: number | null;
  isOverdue: boolean;
  label: string;
} {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (!project.deadline) {
    return { durationDays: null, daysRemaining: null, daysOverdue: null, isOverdue: false, label: "No deadline set" };
  }

  const deadlineDate = parseISO(project.deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const startDate = project.start_date ? parseISO(project.start_date) : parseISO(project.created_at);
  startDate.setHours(0, 0, 0, 0);

  const durationDays = Math.max(1, differenceInDays(deadlineDate, startDate));
  const diffFromToday = differenceInDays(deadlineDate, now);

  if (project.status === "completed") {
    return {
      durationDays,
      daysRemaining: 0,
      daysOverdue: 0,
      isOverdue: false,
      label: "Delivered",
    };
  }

  if (diffFromToday < 0) {
    const daysOverdue = Math.abs(diffFromToday);
    return {
      durationDays,
      daysRemaining: 0,
      daysOverdue,
      isOverdue: true,
      label: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
    };
  }

  if (diffFromToday === 0) {
    return {
      durationDays,
      daysRemaining: 0,
      daysOverdue: 0,
      isOverdue: false,
      label: "Due today",
    };
  }

  return {
    durationDays,
    daysRemaining: diffFromToday,
    daysOverdue: 0,
    isOverdue: false,
    label: `${diffFromToday} day${diffFromToday === 1 ? "" : "s"} remaining`,
  };
}

// ---------------------------------------------------------------------------
// Progress ------------------------------------------------------------------

/**
 * Canonical Project Progress Calculation — SADA WORK OS
 * Requirements:
 * - total = number of tasks
 * - done = tasks with status === 'done'
 * - total === 0 -> 0
 * - otherwise Math.round((done / total) * 100)
 */
export function computeProjectProgress(tasks: TaskRow[]): number {
  const total = tasks.length;
  if (total === 0) return 0;
  const done = tasks.filter(t => t.status === "done").length;
  return Math.round((done / total) * 100);
}

export function computeProgress(tasks: TaskRow[]): {
  total: number;
  done: number;
  inProgress: number;
  review: number;
  blocked: number;
  upcoming: number;
  overdue: number;
  percent: number;
} {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const review = tasks.filter(t => t.status === "review").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const overdue = tasks.filter(t => isTaskOverdue(t)).length;
  const upcoming = tasks.filter(t =>
    (t.status === "todo" || t.status === "in_progress") && !isTaskOverdue(t)
  ).length;
  const percent = computeProjectProgress(tasks);
  return { total, done, inProgress, review, blocked, upcoming, overdue, percent };
}

export function isTaskOverdue(task: { deadline?: string | null; status?: string | null } | TaskRow, refDate: Date = new Date()): boolean {
  if (
    !task ||
    task.status === "done" ||
    task.status === "completed" ||
    task.status === "delivered" ||
    task.status === "approved" ||
    task.status === "cancelled"
  ) {
    return false;
  }
  if (!task.deadline) return false;

  try {
    const rawDeadline = String(task.deadline).trim();
    if (!rawDeadline) return false;

    let deadlineDate: Date;
    if (rawDeadline.includes("T")) {
      // Full ISO timestamp (e.g. 2026-10-14T10:00:00Z)
      deadlineDate = parseISO(rawDeadline);
    } else {
      // Date-only string (e.g. 2026-10-14): task is overdue strictly after the end of that day
      deadlineDate = endOfDay(parseISO(rawDeadline));
    }

    if (!isValid(deadlineDate) || isNaN(deadlineDate.getTime())) {
      const fallbackDate = new Date(rawDeadline);
      if (!isValid(fallbackDate) || isNaN(fallbackDate.getTime())) {
        return false;
      }
      deadlineDate = rawDeadline.includes("T") ? fallbackDate : endOfDay(fallbackDate);
    }

    return refDate.getTime() > deadlineDate.getTime();
  } catch {
    return false;
  }
}

// Deadline display ---------------------------------------------------------

export function deadlineLabel(deadline: string | null): { text: string; className: string } | null {
  if (!deadline) return null;
  const isRtl = typeof document !== "undefined" && (document.documentElement.dir === "rtl" || document.documentElement.lang === "ar");
  const d = parseISO(deadline);
  if (isToday(d)) return { text: isRtl ? "مستحق اليوم" : "Due today", className: "text-amber-600 font-medium" };
  if (isTomorrow(d)) return { text: isRtl ? "مستحق غداً" : "Due tomorrow", className: "text-amber-500" };
  if (isPast(d)) return { text: isRtl ? `متأخر · ${formatDate(d, "d MMM")}` : `Overdue · ${format(d, "d MMM")}`, className: "text-destructive font-medium" };
  return { text: formatDate(d, "d MMM"), className: "text-muted-foreground" };
}

// Format minutes -----------------------------------------------------------

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Starter Checklist Generator
// ---------------------------------------------------------------------------

export interface StarterTaskTemplate {
  title: string;
  category: string;
  priority: TaskPriority;
  description: string;
}

export function getStarterChecklistForServices(services: string[]): StarterTaskTemplate[] {
  const templates: StarterTaskTemplate[] = [
    {
      title: "Client Kickoff & Discovery Alignment",
      category: "Discovery",
      priority: "high",
      description: "Review client questionnaire brief, clarify expectations, and confirm project scope.",
    },
    {
      title: "Brand Assets & Access Collection",
      category: "Discovery",
      priority: "medium",
      description: "Collect logo files, brand guidelines, credentials, and reference links from client.",
    },
  ];

  const joined = services.join(" ").toLowerCase();

  // Branding / Identity
  if (joined.includes("brand") || joined.includes("logo") || joined.includes("identity")) {
    templates.push(
      {
        title: "Brand Strategy & Positioning Brief",
        category: "Strategy",
        priority: "high",
        description: "Formulate brand pillars, target audience persona, and tone of voice.",
      },
      {
        title: "Visual Identity & Moodboard Direction",
        category: "Design",
        priority: "medium",
        description: "Explore color palette, typography hierarchy, and visual direction.",
      },
      {
        title: "Logo Concept Exploration & Refinement",
        category: "Design",
        priority: "high",
        description: "Draft primary, secondary logos, and icon mark system.",
      },
      {
        title: "Brand Guidelines Delivery",
        category: "Launch",
        priority: "medium",
        description: "Package vectors, typography licenses, and usage rulebook for client.",
      }
    );
  }

  // Website / UI/UX / Web Development
  if (joined.includes("web") || joined.includes("ui") || joined.includes("site")) {
    templates.push(
      {
        title: "Site Architecture & User Flow Wireframe",
        category: "Strategy",
        priority: "high",
        description: "Map key conversion funnels, section hierarchy, and page structure.",
      },
      {
        title: "UI/UX High-Fidelity Prototype",
        category: "Design",
        priority: "high",
        description: "Design responsive desktop and mobile screens according to SADA design principles.",
      },
      {
        title: "Frontend & Responsive Implementation",
        category: "Development",
        priority: "high",
        description: "Build clean, accessible, performant components and interactive states.",
      },
      {
        title: "SEO Meta & Analytics Integration",
        category: "Development",
        priority: "medium",
        description: "Configure OpenGraph meta tags, Google Analytics, and speed optimization.",
      },
      {
        title: "Domain Setup & Production Launch",
        category: "Launch",
        priority: "urgent",
        description: "Final QA checklist, DNS record configuration, and live deployment verification.",
      }
    );
  }

  // Marketing / Meta Ads / Social Media / Content
  if (
    joined.includes("marketing") ||
    joined.includes("ad") ||
    joined.includes("social") ||
    joined.includes("content")
  ) {
    templates.push(
      {
        title: "Campaign Strategy & Offer Angle Definition",
        category: "Strategy",
        priority: "high",
        description: "Formulate compelling marketing hooks, audience segments, and promotional offers.",
      },
      {
        title: "Creative Production (Ad Copy & Visuals)",
        category: "Production",
        priority: "high",
        description: "Write conversion-oriented ad copy and produce high-impact visual assets.",
      },
      {
        title: "Conversion Tracking & Pixel Verification",
        category: "Development",
        priority: "high",
        description: "Verify tracking events, custom conversions, and lead form triggers.",
      },
      {
        title: "Campaign Launch & Initial A/B Testing",
        category: "Launch",
        priority: "urgent",
        description: "Launch campaigns, monitor initial CPA / CPC, and optimize winning ad sets.",
      }
    );
  }

  // Production / Video / Photography / Reels
  if (
    joined.includes("video") ||
    joined.includes("photo") ||
    joined.includes("reel") ||
    joined.includes("production")
  ) {
    templates.push(
      {
        title: "Production Shot List & Storyboard",
        category: "Strategy",
        priority: "medium",
        description: "Outline shoot schedule, key scenes, styling requirements, and gear.",
      },
      {
        title: "Production Shoot Execution",
        category: "Production",
        priority: "high",
        description: "On-location filming or studio shoot with creative direction.",
      },
      {
        title: "Post-Production (Color, Sound, Cuts)",
        category: "Production",
        priority: "high",
        description: "Video editing, motion graphics, audio mastering, and exports.",
      }
    );
  }

  // Automation / AI
  if (joined.includes("automation") || joined.includes("ai")) {
    templates.push(
      {
        title: "Workflow Mapping & Architecture Plan",
        category: "Strategy",
        priority: "medium",
        description: "Map data flow between CRM, notifications, and customer touchpoints.",
      },
      {
        title: "Automation Pipeline Configuration",
        category: "Development",
        priority: "high",
        description: "Build logic triggers, webhook connections, and AI prompt workflows.",
      },
      {
        title: "End-to-End Stress Test & Handover",
        category: "Launch",
        priority: "medium",
        description: "Verify edge cases, error fallbacks, and train client on operation.",
      }
    );
  }


  return templates;
}

export interface PreparedStarterTask {
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  assignee_id: string | null;
  suggested_member_name?: string;
  deadline: string | null;
  sort_order: number;
}

/**
 * Deterministically assigns starter tasks and computes relative deadlines based on project timeline.
 * 
 * Rules:
 * A. If task matches a specialized active team member (division, position, specialties) -> assign that member's profile_id.
 * B. If no specialist match -> assign projectLeadProfileId.
 * C. Never assign inactive members.
 * D. Never assign invalid profile IDs (always validates via resolveToProfileId).
 * E. Zero AI, 100% deterministic and predictable.
 * 
 * Deadlines:
 * - If start_date and target_deadline exist: distribute tasks proportionally across project timeline.
 * - If only start_date exists: calculate deterministic day offsets from start.
 * - If neither exists: null.
 */
export function assignStarterTasksIntelligently(
  templates: StarterTaskTemplate[],
  projectLeadProfileId: string | null,
  teamMembers: TeamMemberRow[] = [],
  profiles: ProfileRow[] = [],
  startDateStr?: string | null,
  targetDeadlineStr?: string | null
): PreparedStarterTask[] {
  // 1. Filter active members who have a valid profile_id that exists in profiles
  const activeSpecialists = teamMembers.filter(m => {
    if (!m.is_active || !m.profile_id) return false;
    if (profiles.length > 0 && !profiles.some(p => p.id === m.profile_id)) return false;
    return true;
  });

  // Safe verified project lead profile id
  const verifiedLeadProfileId = resolveToProfileId(projectLeadProfileId, teamMembers, profiles);

  // Helper to find best active specialist for a category / title
  const findSpecialistProfileId = (category: string, title: string): { profileId: string | null; name: string } => {
    const catLower = category.toLowerCase();
    const titleLower = title.toLowerCase();

    // Discovery / Kickoff / Access tasks belong to Project Lead
    if (catLower.includes("discovery") || titleLower.includes("kickoff") || titleLower.includes("access")) {
      const leadMember = teamMembers.find(m => m.profile_id === verifiedLeadProfileId);
      return {
        profileId: verifiedLeadProfileId,
        name: leadMember?.display_name || leadMember?.name || "Project Lead"
      };
    }

    // Development / Technical / SEO / Analytics
    if (
      catLower.includes("development") ||
      titleLower.includes("frontend") ||
      titleLower.includes("responsive") ||
      titleLower.includes("seo") ||
      titleLower.includes("domain") ||
      titleLower.includes("pixel") ||
      titleLower.includes("automation") ||
      titleLower.includes("pipeline")
    ) {
      const devMember = activeSpecialists.find(m => 
        m.division === "Development" ||
        m.position.toLowerCase().includes("engineer") ||
        m.position.toLowerCase().includes("developer") ||
        m.specialties.some(s => s.toLowerCase().includes("web") || s.toLowerCase().includes("dev"))
      );
      if (devMember && devMember.profile_id) {
        return { profileId: devMember.profile_id, name: devMember.display_name || devMember.name };
      }
    }

    // Design / UI/UX / Wireframe / Prototype / Logo / Brand identity
    if (
      catLower.includes("design") ||
      titleLower.includes("wireframe") ||
      titleLower.includes("prototype") ||
      titleLower.includes("moodboard") ||
      titleLower.includes("logo") ||
      titleLower.includes("visual identity")
    ) {
      const designMember = activeSpecialists.find(m => 
        m.division === "Design" ||
        m.position.toLowerCase().includes("design") ||
        m.specialties.some(s => s.toLowerCase().includes("design") || s.toLowerCase().includes("ui") || s.toLowerCase().includes("brand"))
      );
      if (designMember && designMember.profile_id) {
        return { profileId: designMember.profile_id, name: designMember.display_name || designMember.name };
      }
    }

    // Production / Video / Shoot / Editing
    if (
      catLower.includes("production") ||
      titleLower.includes("shoot") ||
      titleLower.includes("video") ||
      titleLower.includes("post-production") ||
      titleLower.includes("cut") ||
      titleLower.includes("color")
    ) {
      const prodMember = activeSpecialists.find(m => 
        m.division === "Production" ||
        m.position.toLowerCase().includes("video") ||
        m.position.toLowerCase().includes("producer") ||
        m.specialties.some(s => s.toLowerCase().includes("video") || s.toLowerCase().includes("photo") || s.toLowerCase().includes("film"))
      );
      if (prodMember && prodMember.profile_id) {
        return { profileId: prodMember.profile_id, name: prodMember.display_name || prodMember.name };
      }
    }

    // Marketing / Ads / Social / Copy / Angles
    if (
      catLower.includes("marketing") ||
      catLower.includes("strategy") ||
      titleLower.includes("campaign") ||
      titleLower.includes("offer") ||
      titleLower.includes("ad copy")
    ) {
      const mktMember = activeSpecialists.find(m => 
        m.division === "Marketing" ||
        m.position.toLowerCase().includes("marketing") ||
        m.position.toLowerCase().includes("strategist") ||
        m.specialties.some(s => s.toLowerCase().includes("ad") || s.toLowerCase().includes("marketing") || s.toLowerCase().includes("growth"))
      );
      if (mktMember && mktMember.profile_id) {
        return { profileId: mktMember.profile_id, name: mktMember.display_name || mktMember.name };
      }
    }

    // Default fallback: Project Lead
    if (verifiedLeadProfileId) {
      const leadMember = teamMembers.find(m => m.profile_id === verifiedLeadProfileId);
      return {
        profileId: verifiedLeadProfileId,
        name: leadMember?.display_name || leadMember?.name || "Project Lead"
      };
    }

    // First active member if no lead specified
    if (activeSpecialists.length > 0) {
      return {
        profileId: activeSpecialists[0].profile_id || null,
        name: activeSpecialists[0].display_name || activeSpecialists[0].name
      };
    }

    return { profileId: null, name: "Unassigned" };
  };

  // 2. Deadline calculation
  let parsedStart: Date | null = null;
  if (startDateStr) {
    try {
      parsedStart = parseISO(startDateStr);
      if (isNaN(parsedStart.getTime())) parsedStart = null;
    } catch {
      parsedStart = null;
    }
  }

  let parsedEnd: Date | null = null;
  if (targetDeadlineStr) {
    try {
      parsedEnd = parseISO(targetDeadlineStr);
      if (isNaN(parsedEnd.getTime())) parsedEnd = null;
    } catch {
      parsedEnd = null;
    }
  }

  const hasBothDates = parsedStart !== null && parsedEnd !== null;
  const hasStartDate = parsedStart !== null;

  let totalTimelineDays = 0;
  if (hasBothDates && parsedStart && parsedEnd) {
    totalTimelineDays = Math.max(1, differenceInDays(parsedEnd, parsedStart));
  }

  return templates.map((tmpl, idx) => {
    // Determine assignee
    const specialist = findSpecialistProfileId(tmpl.category, tmpl.title);
    const resolvedAssigneeId = resolveToProfileId(specialist.profileId, teamMembers, profiles);

    // Determine deadline
    let computedDeadline: string | null = null;

    if (hasBothDates && parsedStart && parsedEnd) {
      const catLower = tmpl.category.toLowerCase();
      let ratio = 0.5; // default middle

      if (catLower.includes("discovery")) ratio = 0.15;
      else if (catLower.includes("strategy")) ratio = 0.35;
      else if (catLower.includes("design") || catLower.includes("production")) ratio = 0.60;
      else if (catLower.includes("development")) ratio = 0.80;
      else if (catLower.includes("launch")) ratio = 1.00;

      // Ensure slight progression across tasks
      const sequenceRatio = (idx + 1) / templates.length;
      const finalRatio = Math.max(0.1, Math.min(1.0, (ratio * 0.7) + (sequenceRatio * 0.3)));
      const daysToAdd = Math.round(totalTimelineDays * finalRatio);
      computedDeadline = format(addDays(parsedStart, Math.min(totalTimelineDays, daysToAdd)), "yyyy-MM-dd");
    } else if (hasStartDate && parsedStart) {
      const catLower = tmpl.category.toLowerCase();
      let offsetDays = 3;
      if (catLower.includes("discovery")) offsetDays = 2 + (idx % 2);
      else if (catLower.includes("strategy")) offsetDays = 5 + (idx % 2);
      else if (catLower.includes("design")) offsetDays = 9 + (idx % 3);
      else if (catLower.includes("production")) offsetDays = 12 + (idx % 3);
      else if (catLower.includes("development")) offsetDays = 16 + (idx % 3);
      else if (catLower.includes("launch")) offsetDays = 21 + (idx % 2);
      else offsetDays = 3 + (idx * 2);

      computedDeadline = format(addDays(parsedStart, offsetDays), "yyyy-MM-dd");
    }

    return {
      title: tmpl.title,
      description: tmpl.description,
      category: tmpl.category,
      priority: tmpl.priority,
      assignee_id: resolvedAssigneeId,
      suggested_member_name: specialist.name,
      deadline: computedDeadline,
      sort_order: idx,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily Execution Helpers for SADA Work OS
// ---------------------------------------------------------------------------

export interface UserExecutionTasks {
  todo: TaskRow[];
  inProgress: TaskRow[];
  review: TaskRow[];
  blocked: TaskRow[];
  doneToday: TaskRow[];
  overdue: TaskRow[];
  dueToday: TaskRow[];
}

export function getUserExecutionTasks(tasks: TaskRow[], userId?: string, memberId?: string): UserExecutionTasks {
  const userTasks = (userId || memberId)
    ? tasks.filter(t => (userId && t.assignee_id === userId) || (memberId && t.assignee_id === memberId))
    : tasks;

  const todo = userTasks.filter(t => t.status === "todo" && !isTaskOverdue(t) && (!t.deadline || !isToday(parseISO(t.deadline))));
  const inProgress = userTasks.filter(t => t.status === "in_progress" && !isTaskOverdue(t) && (!t.deadline || !isToday(parseISO(t.deadline))));
  const review = userTasks.filter(t => t.status === "review");
  const blocked = userTasks.filter(t => t.status === "blocked");
  const overdue = userTasks.filter(t => isTaskOverdue(t));
  const dueToday = userTasks.filter(t => t.deadline && isToday(parseISO(t.deadline)) && t.status !== "done" && t.status !== "cancelled");
  const doneToday = userTasks.filter(t => {
    if (t.status !== "done") return false;
    const dateStr = t.completed_at || t.updated_at;
    return dateStr ? isToday(parseISO(dateStr)) : false;
  });

  return { todo, inProgress, review, blocked, doneToday, overdue, dueToday };
}

export interface UserWorkloadStats {
  activeCount: number;
  dueTodayCount: number;
  overdueCount: number;
  blockedCount: number;
  completedTodayCount: number;
  intensity: "Light" | "Balanced" | "Moderate" | "Heavy";
  intensityColor: string;
  intensityBg: string;
}

export function calculateUserWorkload(tasks: TaskRow[], userId?: string, memberId?: string): UserWorkloadStats {
  const userTasks = (userId || memberId)
    ? tasks.filter(t => (userId && t.assignee_id === userId) || (memberId && t.assignee_id === memberId))
    : tasks;
  const active = userTasks.filter(t => t.status !== "done" && t.status !== "cancelled");
  const dueTodayCount = active.filter(t => t.deadline && isToday(parseISO(t.deadline))).length;
  const overdueCount = active.filter(t => isTaskOverdue(t)).length;
  const blockedCount = active.filter(t => t.status === "blocked").length;
  const completedTodayCount = userTasks.filter(t => {
    if (t.status !== "done") return false;
    const d = t.completed_at || t.updated_at;
    return d ? isToday(parseISO(d)) : false;
  }).length;

  const count = active.length;
  let intensity: UserWorkloadStats["intensity"] = "Light";
  let intensityColor = "text-emerald-600 dark:text-emerald-400";
  let intensityBg = "bg-emerald-500/10 border-emerald-500/30";

  if (count >= 12 || overdueCount >= 3) {
    intensity = "Heavy";
    intensityColor = "text-destructive";
    intensityBg = "bg-destructive/10 border-destructive/30";
  } else if (count >= 8 || overdueCount >= 1) {
    intensity = "Moderate";
    intensityColor = "text-amber-600 dark:text-amber-400";
    intensityBg = "bg-amber-500/10 border-amber-500/30";
  } else if (count >= 4) {
    intensity = "Balanced";
    intensityColor = "text-primary";
    intensityBg = "bg-primary/10 border-primary/30";
  }

  return {
    activeCount: count,
    dueTodayCount,
    overdueCount,
    blockedCount,
    completedTodayCount,
    intensity,
    intensityColor,
    intensityBg,
  };
}

export interface ProjectDeliveryItem {
  project: ProjectRow;
  deliverables: {
    id: string;
    title: string;
    deadline: string | null;
    service: string | null;
    status: TaskStatus;
    links?: string[];
  }[];
}

export function getDeliveriesByProject(projects: ProjectRow[], tasks: TaskRow[]): ProjectDeliveryItem[] {
  const result: ProjectDeliveryItem[] = [];

  for (const project of projects) {
    const pTasks = tasks.filter(t => t.project_id === project.id);
    const delivTasks = pTasks.filter(t =>
      t.result_title ||
      (t.result_links && t.result_links.length > 0) ||
      t.category?.toLowerCase().includes("delivery") ||
      t.category?.toLowerCase().includes("launch") ||
      t.category?.toLowerCase().includes("production") ||
      t.category?.toLowerCase().includes("marketing") ||
      Boolean(t.service) ||
      t.status === "review" ||
      t.status === "delivered"
    );

    if (delivTasks.length > 0) {
      result.push({
        project,
        deliverables: delivTasks.map(t => ({
          id: t.id,
          title: t.result_title || t.title,
          deadline: t.deadline,
          service: t.service || t.category,
          status: t.status,
          links: t.result_links,
        })),
      });
    }
  }

  return result;
}

export interface TeamPulseMember {
  member: TeamMemberRow;
  profile: ProfileRow;
  activeCount: number;
  urgentCount: number;
  dueTodayCount: number;
  overdueCount: number;
  inProgressCount: number;
  topTaskTitle: string | null;
  capacityBadge: { label: string; color: string };
}

/**
 * Resolves Project Lead member info from lead_id.
 * Uses unified team_members and profiles sources of truth.
 */
export function getProjectLeadInfo(
  leadId: string | null | undefined,
  teamMembers?: TeamMemberRow[],
  profiles?: ProfileRow[]
): {
  id: string | null;
  displayName: string;
  name: string;
  position?: string;
  photoUrl?: string | null;
  hasProfile: boolean;
} | null {
  if (!leadId) return null;
  return getAssignmentMemberInfo(leadId, teamMembers, profiles);
}

/**
 * Team Pulse calculation using unified team_members as single source of truth.
 * Bridges profile_id to project_tasks assignments and respects is_active and availability_status.
 */
export function getTeamPulse(
  teamMembersOrProfiles: TeamMemberRow[] | ProfileRow[],
  tasks: TaskRow[],
  fallbackProfiles?: ProfileRow[]
): TeamPulseMember[] {
  if (!teamMembersOrProfiles || teamMembersOrProfiles.length === 0) return [];

  const isTeamMemberList = "division" in teamMembersOrProfiles[0] || "is_active" in teamMembersOrProfiles[0];

  if (isTeamMemberList) {
    const teamMembers = teamMembersOrProfiles as TeamMemberRow[];
    const activeMembers = teamMembers.filter(m => m.is_active !== false);
    const profileMap = new Map((fallbackProfiles || []).map(p => [p.id, p]));

    return activeMembers.map(member => {
      const profileId = member.profile_id;
      const memberTasks = tasks.filter(t =>
        (profileId && t.assignee_id === profileId) || t.assignee_id === member.id
      );
      const activeTasks = memberTasks.filter(t => t.status !== "done" && t.status !== "cancelled");
      const urgentCount = activeTasks.filter(t => t.priority === "urgent").length;
      const dueTodayCount = activeTasks.filter(t => t.deadline && isToday(parseISO(t.deadline))).length;
      const overdueCount = activeTasks.filter(t => isTaskOverdue(t)).length;
      const inProgressTasks = activeTasks.filter(t => t.status === "in_progress");
      const topTaskTitle = inProgressTasks.length > 0
        ? inProgressTasks[0].title
        : activeTasks.length > 0
        ? activeTasks[0].title
        : null;

      let capacityBadge = { label: "Under Capacity", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
      if (activeTasks.length >= 9 || member.availability_status === "overloaded") {
        capacityBadge = { label: "Overloaded", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
      } else if (activeTasks.length >= 5 || member.availability_status === "busy") {
        capacityBadge = { label: "Heavy Load", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
      } else if (activeTasks.length > 0) {
        capacityBadge = { label: "Balanced", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
      }

      const bridgedProfile: ProfileRow = (profileId && profileMap.get(profileId)) || {
        id: profileId || member.id,
        display_name: member.display_name || member.name,
      };

      return {
        member,
        profile: bridgedProfile,
        activeCount: activeTasks.length,
        urgentCount,
        dueTodayCount,
        overdueCount,
        inProgressCount: inProgressTasks.length,
        topTaskTitle,
        capacityBadge,
      };
    });
  }

  // Fallback for bare ProfileRow[]
  const profiles = teamMembersOrProfiles as ProfileRow[];
  return profiles.map(profile => {
    const memberTasks = tasks.filter(t => t.assignee_id === profile.id && t.status !== "done" && t.status !== "cancelled");
    const urgentCount = memberTasks.filter(t => t.priority === "urgent").length;
    const dueTodayCount = memberTasks.filter(t => t.deadline && isToday(parseISO(t.deadline))).length;
    const overdueCount = memberTasks.filter(t => isTaskOverdue(t)).length;
    const inProgressTasks = memberTasks.filter(t => t.status === "in_progress");
    const topTaskTitle = inProgressTasks.length > 0 ? inProgressTasks[0].title : memberTasks.length > 0 ? memberTasks[0].title : null;

    let capacityBadge = { label: "Under Capacity", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
    if (memberTasks.length >= 9) {
      capacityBadge = { label: "Overloaded", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
    } else if (memberTasks.length >= 5) {
      capacityBadge = { label: "Heavy Load", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    } else if (memberTasks.length > 0) {
      capacityBadge = { label: "Balanced", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    }

    const syntheticMember: TeamMemberRow = {
      id: profile.id,
      profile_id: profile.id,
      name: profile.display_name || "Team Member",
      position: "Specialist",
      division: "General",
      specialties: [],
      sort_order: 99,
      published: false,
      is_active: true,
      availability_status: "available",
      display_name: profile.display_name,
    };

    return {
      member: syntheticMember,
      profile,
      activeCount: memberTasks.length,
      urgentCount,
      dueTodayCount,
      overdueCount,
      inProgressCount: inProgressTasks.length,
      topTaskTitle,
      capacityBadge,
    };
  }).filter(m => m.activeCount > 0);
}

/**
 * Filter and sort agency unassigned tasks deterministically:
 * Overdue first, then by closest deadline, then priority.
 */
export function getAgencyUnassignedTasks(tasks: TaskRow[]): TaskRow[] {
  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return tasks
    .filter(t => !t.assignee_id && t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const aOverdue = isTaskOverdue(a) ? 1 : 0;
      const bOverdue = isTaskOverdue(b) ? 1 : 0;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue;

      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;

      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
}

/**
 * Filter and sort agency overdue tasks deterministically:
 * Urgent priority first, then oldest overdue deadline.
 */
export function getAgencyOverdueTasks(tasks: TaskRow[]): TaskRow[] {
  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return tasks
    .filter(t => isTaskOverdue(t) && t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;

      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });
}

/**
 * Filter and sort agency blocked tasks deterministically:
 * Client-blocked first, then urgent priority, then deadline.
 */
export function getAgencyBlockedTasks(tasks: TaskRow[]): TaskRow[] {
  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return tasks
    .filter(t => t.status === "blocked")
    .sort((a, b) => {
      const aClient = a.waiting_on === "client" ? 1 : 0;
      const bClient = b.waiting_on === "client" ? 1 : 0;
      if (bClient !== aClient) return bClient - aClient;

      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;

      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });
}

export function getProjectsNeedingAttention(projects: ProjectRow[], tasks: TaskRow[]): {
  project: ProjectRow;
  health: ProjectHealthInfo;
  progress: ReturnType<typeof computeProgress>;
  reason: string;
}[] {
  const activeProjects = projects.filter(p => p.status === "active" || p.status === "on_hold");
  const result: { project: ProjectRow; health: ProjectHealthInfo; progress: ReturnType<typeof computeProgress>; reason: string }[] = [];

  for (const project of activeProjects) {
    const pTasks = tasks.filter(t => t.project_id === project.id);
    const health = computeProjectHealth(project, pTasks);
    const progress = computeProgress(pTasks);

    const hasClientWaiting = pTasks.some(t => t.status === "blocked" && t.waiting_on === "client") ||
      project.followup_status === "waiting_for_client" ||
      project.followup_status === "followup_due";

    if (health.health === "at_risk" || health.health === "overdue" || health.health === "on_hold" || hasClientWaiting) {
      let reason = health.reason;
      if (hasClientWaiting && health.health === "on_track") {
        reason = "Waiting on client input or follow-up due";
      }
      result.push({ project, health, progress, reason });
    }
  }

  return result;
}

export { GripVertical, User, CheckCircle2, Circle, Clock, AlertTriangle, Pause, XCircle };

