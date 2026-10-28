# SADA OS — Publishing Workflow Stage Implementation Report
## Content Production -> Publishing Pipeline Architecture & Secure Handoff

**Audit Identifier:** `SADA-OS-PUBLISHING-WORKFLOW-MVP`  
**Execution Date:** 2026-10-14  
**Author:** SADA Architecture & Quality Engineering  
**Scope:** Scenario $\to$ Shooting $\to$ Editing $\to$ Publishing Handoff Architecture  
**Status:** CONDITIONALLY ACCEPTED (Automated & Isolated Verification Passed; Live Browser Blocked by Sandbox Network)

---

## 1. Executive Summary & Mission Scope

The SADA OS content production pipeline has been hardened to support a dedicated, canonical **Publishing stage immediately following Editing** for workflows requiring public content distribution:

$$\text{Scenario / Script} \longrightarrow \text{Shooting} \longrightarrow \text{Editing} \longrightarrow \text{Publishing}$$

### Key Implementation Principles & Guarantees:
1. **Single Source of Truth (SSOT):** SADA OS remains the absolute canonical authority for task identity, ownership, workflow state, deadlines, assignments, progress, and operational history.
2. **Publer Integration Strictly Out-of-Scope:** Publer remains a 100% manual external process. No automated social posting, external API calls, or account synchronization were introduced.
3. **Parent Completion Invariant:** Completing Editing marks the editing stage `done` and brings deliverable progress to 75%, but the parent deliverable strictly remains `in_progress`. The parent deliverable completes (100% `done`) **only after the Publisher confirms live publication**.
4. **Zero Shared-Database Mutations:** All verification was conducted with pure unit test suites (`scripts/test-publishing-workflow.ts`), static typechecking (`npx tsc --noEmit`), and production bundle compilation (`npm run build`). No test data was inserted into the shared Supabase instance.
5. **Zero New Database Migrations Required:** Reuses existing production schema columns (`project_tasks.drive_url`, `published_urls`, `published_at`, `published_by`, `target_platforms`, `team_members.is_publisher`, `clients.social_accounts`, and `project_activity.idempotency_key`).

---

## 2. Actual Files Changed & Component Inventory

| File Path | Type | Role & Responsibilities |
| :--- | :--- | :--- |
| `src/lib/publishing-workflow-service.ts` | Backend Service | Authoritative actor resolution, Drive URL validation, platform & URL integrity, stage eligibility, idempotent handoff, publisher auto-assignment, unassigned publisher alerting, parent completion invariants, and client social account isolation. |
| `src/components/admin/TaskDetailModal.tsx` | Core UI Dialog | Central task workspace modal. Intercepts subtask checkbox clicks and action buttons for Editing and Publishing stages to route through specialized SADA Dialogs (`CompleteEditingModal`, `PublishContentModal`). Suppresses generic complete button to prevent workflow bypass. |
| `src/components/admin/tasks/CompleteEditingModal.tsx` | UI Modal | SADA Design System dialog for Editor handoff. Enforces mandatory cloud Drive URL validation, notes, publisher selection, and triggers `completeEditingAndHandoffToPublishing`. |
| `src/components/admin/tasks/PublishContentModal.tsx` | UI Modal | SADA Design System dialog for Publisher action. Displays inherited Drive URL, copies client social handles, presents platform selector, captures live post URLs, and triggers `markContentPublished`. |
| `src/lib/workflow-service.ts` | Core Engine | Canonical workflow templates registry, prerequisite stage dependency engine (`checkStageActionability`), dynamic progress calculation (`computeWorkflowProgress`), and worker matching. |
| `scripts/test-publishing-workflow.ts` | Test Suite | 15 comprehensive automated test suites covering 63 discrete assertions with zero database mutations. |

---

## 3. Workflow Architecture & Representation

### 3.1 Task & Stage Hierarchy
- Stages are modeled as **first-class child task records** in `public.project_tasks` linked to their parent deliverable via `parent_task_id`.
- Stage execution sequence is governed by `sort_order` (1: Script, 2: Shooting, 3: Editing, 4: Publishing).
- Prerequisite locking is evaluated dynamically via `checkStageActionability(stageTask, siblingTasks)`. Stage 4 (Publishing) remains locked with `is_stage_locked: true` until Stage 3 (Editing) is marked `done`.

### 3.2 Workflow Applicability & Backward Compatibility
- **Publishing-Applicable Workflows:** Workflows defining a publishing stage (e.g. `reel` with 4 stages, `design` with 3 stages) mandate the Publishing handoff and will not complete the parent task until Publishing is completed.
- **Non-Publishing Workflows:** Workflows without a publishing stage (e.g. `web_development` with 4 stages: Brief $\to$ Design $\to$ Dev $\to$ QA, `sponsoring` campaigns, or internal operational tasks) complete normally when all their configured stages reach `done`. Publishing is never forced onto unrelated tasks.
- **Historical Tasks:** Existing completed tasks remain 100% untouched.

---

## 4. Canonical Field Sources of Truth

| Field Name | Table | Data Type | Canonical Purpose & Rules |
| :--- | :--- | :--- | :--- |
| `drive_url` | `public.project_tasks` | `TEXT` | Validated HTTP/HTTPS cloud deliverable URL submitted by the Editor upon editing completion. Inherited by Publishing stage and parent task. |
| `published_urls` | `public.project_tasks` | `TEXT[]` | Live social media post URLs submitted by the Publisher to prove live publication. |
| `target_platforms` | `public.project_tasks` | `TEXT[]` | Canonical platforms posted to (`instagram`, `facebook`, `tiktok`, `youtube_shorts`, `linkedin`, `twitter_x`). |
| `published_at` | `public.project_tasks` | `TIMESTAMPTZ` | Timestamp when content was confirmed published. |
| `published_by` | `public.project_tasks` | `UUID -> profiles.id` | Authoritative user ID of the Publisher who confirmed publication. |
| `is_publisher` | `public.team_members` | `BOOLEAN` | Capability flag indicating if a team member possesses Publisher permissions. |
| `social_accounts` | `public.clients` | `JSONB` | Client social handles (Instagram, TikTok, Facebook). Isolated from billing/financial retainer data. |
| `idempotency_key` | `public.project_activity` | `TEXT (UNIQUE)` | Exactly-once audit milestone deduplication key preventing duplicate entries on network retries. |

---

## 5. Editing Completion & Publishing Handoff Flow

When an Editor completes editing in a workflow requiring publishing:

```
[Editor submits Drive Link]
             │
             ▼
[Server-Side URL & Prerequisite Validation]
             │ (Fail -> Rejection error)
             ▼
[Atomic State Mutation in project_tasks]
  ├── Editing stage status -> 'done'
  ├── Editing stage drive_url & result_links updated
  ├── Parent task drive_url updated (Parent remains 'in_progress' at 75%)
  ├── Publishing stage unlocked (status -> 'todo', is_stage_locked -> false)
  └── Publishing stage inherits drive_url
             │
             ▼
[Publisher Resolution & Capability Check]
  ├── Eligible Publisher found -> Assigned to Publishing stage
  └── No Publisher found -> Task left unassigned; Alert sent to Manager
             │
             ▼
[Idempotent Notification Dispatched]
  └── High-priority alert sent via emitNotification with deduplicationKey
             │
             ▼
[Exactly-Once Activity & Audit Logging]
  ├── content_prepared (idempotency_key: content_prepared_${id})
  ├── drive_link_added (idempotency_key: drive_link_added_${id})
  ├── ready_for_publishing (idempotency_key: ready_for_publishing_${id})
  └── publisher_assigned (idempotency_key: publisher_assigned_${id}_${pubId})
```

---

## 6. Manual Publer Workflow Integration

Publer is strictly an external manual execution tool:

1. **Open Task:** The designated Publisher opens the assigned Publishing task in SADA OS.
2. **Review Details:** Reads parent deliverable title, client metadata, and special instructions.
3. **Access Content:** Clicks **"Open Asset"** to review/download the final video from the inherited Google Drive / cloud link.
4. **Copy Social Handles:** Clicks one-click copy buttons for client handles (e.g. `@luxurybrand_official`).
5. **External Publer Execution:** Publisher opens Publer in a separate browser tab, selects accounts, uploads asset, configures caption, and publishes/schedules.
6. **Return to SADA OS:** Publisher enters live post URL(s) and selects the target platforms.
7. **Complete Publishing:** Publisher clicks **"Mark as Published"**.
8. **Final Invariant Execution:** The publishing task status becomes `done`, `published_urls` and `published_at` are persisted, and if all sibling stages are done, the parent deliverable reaches 100% and becomes `done`.

---

## 7. Publisher Assignment & Security Model

- **No Top-Level Role Escalation:** Publishers remain `role: "worker"` (or `admin`/`super_admin`) with the specific capability `team_members.is_publisher = true` or matching publisher specialty.
- **Fail-Closed Unassigned Handling:** If no team member has the publisher capability, SADA OS **never** assigns an arbitrary user. The task is set to `assignee_id: null` (unassigned) and a high-priority alert is dispatched to the project manager/assigner to manually assign an authorized publisher.
- **Client Data Isolation:** `getClientPublishingInfo` strictly queries client name, industry, and social accounts, while completely excluding billing retainers, margins, hourly rates, and invoice data.
- **Direct Mutation Authorization:** `resolvePublishingActor` authenticates the actor against `profiles` and `team_members`, verifying account status is not suspended or deactivated before allowing mutations.

---

## 8. Calendar & Notification Behavior

### Calendar
- Tasks in the calendar are projected directly from `public.project_tasks`. No parallel events table is created.
- Publishing tasks appear on the calendar according to their scheduled date / deadline.
- When a publisher is assigned, the task immediately surfaces on their personal calendar projection.
- Task deadline (`deadline`) and scheduled publishing time (`scheduled_date`) are stored in distinct fields.

### Notifications
- Dispatched via `emitNotification()` using unique partial index keys in `public.notifications`.
- Duplicate submissions, page refreshes, or network retries use deterministic deduplication keys (`handoff_pub_${id}`, `published_notify_${id}`), ensuring exactly one notification is delivered.

---

## 9. Design System & UX Standards

All UI touchpoints adhere strictly to the **SADA Design System**:
- Built using approved SADA UI components (`SADADialog`, `SADAButton`, `SADAInput`, `SADATextarea`, `SADABadge`, `SADASelect`, `SADACheckbox`).
- Context-aware action buttons: Editing displays a purple "Complete & Hand Off to Publishing" button; Publishing displays an emerald "Publish to Social Accounts" button.
- Comprehensive support for **Light and Dark themes**.
- Native **Arabic RTL and English LTR** internationalization.
- Clean validation toasts via `sonner`.
- Responsive layout supporting desktop, tablet, and mobile displays.

---

## 10. Audit Sign-off

- **Architecture:** Approved (Modular, backward compatible, canonical SSOT).
- **Security & RBAC:** Approved (Worker capability isolation, client financial data shielded).
- **Database Safety:** Approved (Zero migrations, zero test mutations on shared database).
- **Automated Verification:** Approved (63/63 unit tests passed, TypeScript 0 errors, build clean).
- **MVP Certification:** **CONDITIONALLY ACCEPTED** (Pending manual visual checklist execution; refer to `docs/audit/mvp/publishing-workflow-final-acceptance.md`).
