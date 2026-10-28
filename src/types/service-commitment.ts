// ============================================================
// SADA OS — RECURRING CLIENT-SERVICE SCHEDULING TYPES
// Phase 2: Service Commitments, Recurring Rules & Idempotent Generation
// ============================================================

export type CommitmentFrequency = "daily" | "weekly" | "monthly" | "bi_weekly";

export type CommitmentLifecycleStatus = "active" | "paused" | "inactive" | "completed";

export type AssignmentRule =
  | "manual"
  | "specialist_role"
  | "project_lead"
  | "specific_worker";

export interface CommitmentScheduleRule {
  frequency?: CommitmentFrequency;
  quantity?: number; // e.g. 2 times/week, 2 days/month, 8/month, 1/month
  days_of_week?: number[]; // 1 = Monday, 7 = Sunday
  days_of_month?: number[]; // 1..31
  preferred_time?: string; // e.g. "10:00"
  default_time?: string;
  duration_hours?: number; // e.g. 2.0 or 4.0
  estimated_minutes?: number;
  interval_weeks?: number; // 1 for every week, 2 for bi-weekly
  interval_days?: number;
}

export interface ServiceCommitment {
  id: string;
  client_id: string;
  package_id?: string | null;
  service_name: string; // e.g. "Stories Shooting", "Reels Shooting", "Posts Publishing", "Photography"
  deliverable_type?: string; // e.g. "stories_shooting", "reels_shooting", "post", "photography", "reel", "story", "ads", "custom"
  category?: string;
  quantity: number;
  frequency: CommitmentFrequency;
  schedule_rule: CommitmentScheduleRule;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  preferred_time?: string | null;
  duration_hours?: number | null;
  assignee_id?: string | null;
  assignment_rule?: AssignmentRule;
  default_role?: string | null; // e.g. "videographer", "photographer", "designer", "copywriter", "media_buyer"
  workflow_template_id?: string | null; // Attached Workflow Template for stage generation!
  task_type?: string | null;
  status?: CommitmentLifecycleStatus;
  lifecycle_status?: CommitmentLifecycleStatus;
  paused_at?: string | null;
  reactivated_at?: string | null;
  deliverable_id?: string | null; // Linked client_deliverables record
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedOccurrence {
  commitment_id: string;
  client_id: string;
  target_date: string; // YYYY-MM-DD
  occurrence_date?: string; // YYYY-MM-DD canonical field
  sequence_index: number; // 1, 2, ... N within the period
  total_in_period: number;
  title: string;
  service_name: string;
  assignee_id?: string | null;
  estimated_hours?: number;
  workflow_template_id?: string | null;
  deliverable_id?: string | null;
  idempotency_key: string;
  source_type?: "recurring_schedule" | "package_reconciliation";
}

export interface ServiceSchedulingPreset {
  service_name: string;
  deliverable_type: string;
  quantity: number;
  frequency: CommitmentFrequency;
  default_days_of_week?: number[];
  default_days_of_month?: number[];
  schedule_rule?: CommitmentScheduleRule;
  duration_hours: number;
  default_role: string;
  workflow_type?: string;
  description: string;
  description_ar: string;
}

export interface GenerationResult {
  success: boolean;
  commitments_processed: number;
  occurrences_evaluated: number;
  tasks_created: number;
  tasks_skipped_existing: number; // Idempotent safety!
  tasks_skipped_paused: number;
  tasks_skipped_inactive: number;
  created_task_ids: string[];
  created_tasks?: any[];
  error?: string;
}

