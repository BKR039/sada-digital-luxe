// ============================================================
// SADA OS — CONFIGURABLE TASK WORKFLOW ENGINE TYPES
// Phase 1: Task Type -> Workflow Template -> Stages -> Task Instances
// ============================================================

export type WorkflowStageType =
  | "brief"
  | "script"
  | "shooting"
  | "editing"
  | "design"
  | "development"
  | "qa"
  | "review"
  | "media_buying"
  | "publishing"
  | "strategy"
  | "optimization"
  | "custom";

export type AssignmentRule =
  | "manual"
  | "specialist_role"
  | "project_lead"
  | "specific_worker";

export interface WorkflowStageDefinition {
  id: string;
  title: string;
  title_ar?: string;
  stage_type: WorkflowStageType | string;
  order: number;
  duration_days: number;
  requires_previous_stage: boolean;
  assignment_rule: AssignmentRule;
  default_assignee_role?: string; // e.g. "copywriter", "videographer", "editor", "designer", "publisher"
  default_assignee_id?: string | null; // specific profiles.id
  description?: string;
  description_ar?: string;
  checklist_items?: string[];
}

export interface WorkflowTemplate {
  id: string;
  task_type: string; // e.g. "reel", "design", "web_development", "sponsoring", "custom"
  name: string;
  name_ar?: string;
  description: string;
  description_ar?: string;
  icon: string; // Lucide icon name
  color: string; // tailwind color prefix, e.g. "purple", "rose", "blue", "emerald"
  is_active: boolean;
  sort_order: number;
  stages: WorkflowStageDefinition[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStageInstance {
  id: string;
  task_id: string;
  parent_task_id: string;
  stage_id: string;
  stage_title: string;
  stage_order: number;
  status: "todo" | "in_progress" | "review" | "done" | "blocked" | "postponed";
  assignee_id: string | null;
  deadline: string | null;
  is_locked: boolean;
  locked_reason?: string;
  completed_at?: string | null;
  result_links?: string[];
  result_notes?: string | null;
}

export interface WorkflowProgressSummary {
  template_id?: string;
  task_type?: string;
  total_stages: number;
  completed_stages: number;
  progress_percent: number;
  current_stage_order: number;
  current_stage_title: string;
  all_completed: boolean;
  stages: {
    id: string;
    order: number;
    title: string;
    status: string;
    assignee_id: string | null;
    deadline: string | null;
    is_locked: boolean;
    completed_at?: string | null;
  }[];
}

// ============================================================
// Phase 7: Content Production -> Publishing Workflow Types
// ============================================================

export type PublishingPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "youtube_shorts"
  | "twitter_x";

export interface ClientSocialAccounts {
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
}

export interface CompleteEditingHandoffInput {
  editingTaskId: string;
  actorId: string;
  driveUrl: string;
  notes?: string;
  customPublisherId?: string;
  publisherId?: string;
  parentTaskId?: string;
  actorRole?: string;
}

export interface PublishContentPayload {
  publishingTaskId: string;
  actorId: string;
  publishedUrls: string[];
  platforms?: PublishingPlatform[];
  targetPlatforms?: PublishingPlatform[];
  notes?: string;
  clientId?: string | null;
  actorRole?: string;
}

export interface ConfigurePublisherCapabilityInput {
  teamMemberId: string;
  isPublisher: boolean;
  actorId?: string;
  actorRole?: string;
}

export interface PublishingAuditTrail {
  contentPreparedBy?: { id: string; name: string } | null;
  driveLinkAddedBy?: { id: string; name: string } | null;
  driveUrl?: string | null;
  readyForPublishingAt?: string | null;
  assignedPublisher?: { id: string; name: string } | null;
  publishedBy?: { id: string; name: string } | null;
  publishedAt?: string | null;
  publishedUrls?: string[];
  platforms?: string[];
}
