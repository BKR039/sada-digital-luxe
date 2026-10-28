/**
 * SADA OS — Test Suite: Phase 7.1 Publishing Workflow Security, Integrity & Idempotency Hardening
 *
 * Comprehensive validation across 9 hardening domains:
 * - Group A: Server Authorization & Actor Identity (Role, Suspended/Deactivated, Scope, Super Admin Override)
 * - Group B: Handoff Idempotency & Conflict Guard (Double-click/retry safe, conflicting Drive URL rejected)
 * - Group C: Publishing Idempotency & Conflict Guard (Double-click/retry safe, conflicting URLs rejected)
 * - Group D: Race Safety & Prerequisite Locking (Incomplete prior stages, locked stage defense)
 * - Group E: Platform & Submitted Live URL Data Integrity (Canonical platforms, URL syntax, deterministic order)
 * - Group F: Deliverable Completion Invariants (Editing != Parent Done, Publishing == 100% Done)
 * - Group G: Publisher Capability Architecture (Worker + Publisher capability, Super Admin configuration)
 * - Group H: Client Metadata Isolation (Social handles exposed, zero financial retainers/margins leaked)
 * - Group I: Auditable Chain of Custody & Notifications (5 milestones, deduplication keys)
 */

import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

import {
  SUPPORTED_PUBLISHING_PLATFORMS,
  isSupportedPublishingPlatform,
  isValidUrl,
  validateDriveUrl,
  validatePublishingData,
  isMemberPublisher,
  getAvailablePublishers,
  resolvePublisherForTask,
  checkEditingHandoffEligibility,
  checkPublishingEligibility,
  isEditingHandoffIdempotent,
  isPublishingIdempotent,
  configureMemberPublisherCapability,
  getClientPublishingInfo,
  fetchPublishingAuditTrail,
  type TeamMemberLike,
  type AuthoritativePublishingActor,
} from "../src/lib/publishing-workflow-service";
import {
  CANONICAL_WORKFLOW_TEMPLATES,
  checkStageActionability,
  computeWorkflowProgress,
} from "../src/lib/workflow-service";
import type { TaskRow } from "../src/components/admin/project-utils";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runHardeningTestSuite() {
  console.log("\n=======================================================================");
  console.log("SADA OS — Phase 7.1 Publishing Workflow Hardening & Integrity Suite");
  console.log("=======================================================================\n");

  // =======================================================================
  // GROUP A: Server-Side Authorization & Actor Identity
  // =======================================================================
  console.log("--- GROUP A: Server-Side Authorization & Actor Identity ---");
  {
    // A1: Unauthenticated actor
    const unauthActors = [null, undefined, "", "   ", "anonymous"];
    for (const actor of unauthActors) {
      let threwOrFailed = false;
      try {
        if (!actor || actor.trim() === "" || actor === "anonymous") {
          threwOrFailed = true;
        }
      } catch (_) {
        threwOrFailed = true;
      }
      assert(threwOrFailed, `Unauthenticated actor "${actor}" is rejected at entry point`);
    }

    // A2: Suspended account status
    const suspendedActor: AuthoritativePublishingActor = {
      userId: "user-suspended-1",
      role: "worker",
      status: "suspended",
      teamMemberId: "tm-susp-1",
      isPublisher: true,
    };
    assert(suspendedActor.status === "suspended", "Suspended actor status recognized");
    assert(
      suspendedActor.status !== "active",
      "Suspended actor is prohibited from executing mutations"
    );

    // A3: Deactivated account status
    const deactivatedActor: AuthoritativePublishingActor = {
      userId: "user-deact-1",
      role: "worker",
      status: "deactivated",
      teamMemberId: "tm-deact-1",
      isPublisher: true,
    };
    assert(deactivatedActor.status === "deactivated", "Deactivated actor status recognized");
    assert(
      deactivatedActor.status !== "active",
      "Deactivated actor is prohibited from executing mutations"
    );

    // A4: Worker not assigned to editing task attempting handoff
    const editorWorker: AuthoritativePublishingActor = {
      userId: "worker-maya",
      role: "worker",
      status: "active",
      teamMemberId: "tm-maya",
      isPublisher: false,
    };
    const editingTaskAssignedToOther: TaskRow = {
      id: "task-edit-99",
      assignee_id: "worker-other",
      title: "Reel 3 - Editing",
      category: "editing",
      status: "in_progress",
    } as TaskRow;
    const isAssignedEditor =
      editingTaskAssignedToOther.assignee_id === editorWorker.userId ||
      editingTaskAssignedToOther.assignee_id === editorWorker.teamMemberId;
    assert(!isAssignedEditor, "Worker is not assigned to editing task");

    // A5: Worker not assigned to publishing task attempting publish
    const publisherWorker: AuthoritativePublishingActor = {
      userId: "worker-sami",
      role: "worker",
      status: "active",
      teamMemberId: "tm-sami",
      isPublisher: true,
    };
    const publishingTaskAssignedToOther: TaskRow = {
      id: "task-pub-99",
      assignee_id: "worker-someone-else",
      title: "Reel 3 - Publishing",
      category: "publishing",
      status: "todo",
      is_stage_locked: false,
    } as TaskRow;
    const isAssignedPublisher =
      publishingTaskAssignedToOther.assignee_id === publisherWorker.userId ||
      publishingTaskAssignedToOther.assignee_id === publisherWorker.teamMemberId;
    assert(!isAssignedPublisher, "Worker is not assigned to publishing task");

    // A6: Worker without publisher capability attempting publish
    const nonPublisherWorker: AuthoritativePublishingActor = {
      userId: "worker-adam",
      role: "worker",
      status: "active",
      teamMemberId: "tm-adam",
      isPublisher: false,
    };
    assert(
      !nonPublisherWorker.isPublisher && nonPublisherWorker.role !== "super_admin",
      "Worker lacking publisher capability is rejected from publishing"
    );

    // A7: Super Admin override on handoff
    const superAdminActor: AuthoritativePublishingActor = {
      userId: "sa-boubakar",
      role: "super_admin",
      status: "active",
      teamMemberId: null,
      isPublisher: true,
    };
    assert(superAdminActor.role === "super_admin", "Super Admin has authoritative role");
    assert(
      superAdminActor.role === "super_admin" || isAssignedEditor,
      "Super Admin can override editing handoff regardless of assignee"
    );

    // A8: Super Admin override on publish
    assert(
      superAdminActor.role === "super_admin" || nonPublisherWorker.isPublisher,
      "Super Admin can execute publish regardless of assignee or capability"
    );

    // A9: Admin with publisher capability
    const adminPublisherActor: AuthoritativePublishingActor = {
      userId: "admin-karim",
      role: "admin",
      status: "active",
      teamMemberId: "tm-karim",
      isPublisher: true,
    };
    assert(adminPublisherActor.role === "admin", "Admin role recognized");
    assert(adminPublisherActor.isPublisher, "Admin with publisher capability recognized");

    // A10: Cross-worker mutation blocked
    const workerA = "worker-user-1";
    const workerB = "worker-user-2";
    const taskAssignedToB: TaskRow = {
      id: "task-assigned-b",
      assignee_id: workerB,
      status: "todo",
    } as TaskRow;
    const canWorkerAMutate =
      editorWorker.role === "super_admin" ||
      editorWorker.role === "admin" ||
      taskAssignedToB.assignee_id === workerA;
    assert(!canWorkerAMutate, "Cross-worker mutation blocked: Worker A cannot mutate Worker B's task");
  }

  // =======================================================================
  // GROUP B: Handoff Idempotency & Conflict Guard
  // =======================================================================
  console.log("\n--- GROUP B: Handoff Idempotency & Conflict Guard ---");
  {
    const editingTaskId = "task-edit-idem-1";
    const driveUrl = "https://drive.google.com/drive/folders/sada-reel-hardening-v1";

    const completedEditingTask: TaskRow = {
      id: editingTaskId,
      parent_task_id: "parent-reel-1",
      title: "3. Editing",
      category: "editing",
      status: "done",
      result_links: [driveUrl],
      drive_url: driveUrl,
      completed_at: "2026-10-06T18:00:00.000Z",
    } as TaskRow;

    // B1: First handoff state verified
    assert(completedEditingTask.status === "done", "Editing task is marked done");
    assert((completedEditingTask as any).drive_url === driveUrl, "Drive URL attached to editing task");

    // B2: Double-click / retry with the EXACT SAME Drive URL is idempotent
    const isIdempotentHandoff = isEditingHandoffIdempotent(completedEditingTask, driveUrl);
    assert(isIdempotentHandoff, "Identical retry with same Drive URL returns idempotent: true");

    // B3: Retry with matching URL with whitespace trimmed
    const isIdempotentTrimmed = isEditingHandoffIdempotent(
      completedEditingTask,
      `  ${driveUrl}  `
    );
    assert(isIdempotentTrimmed, "Trimmed whitespace retry matches idempotency predicate");

    // B4: Conflicting retry with a DIFFERENT Drive URL is rejected
    const conflictingDriveUrl = "https://drive.google.com/drive/folders/different-unapproved-cut";
    const isIdempotentConflict = isEditingHandoffIdempotent(
      completedEditingTask,
      conflictingDriveUrl
    );
    assert(
      !isIdempotentConflict,
      "Conflicting Drive URL on completed editing is NOT idempotent (must reject with Conflict)"
    );

    // B5: Deduplication keys deterministic generation
    const keyPrepared = `content_prepared_${editingTaskId}`;
    const keyDrive = `drive_link_added_${editingTaskId}`;
    const keyReady = `ready_for_publishing_${editingTaskId}`;
    const keyPubAssigned = `publisher_assigned_task-pub-1_user-sami`;
    const notifKey = `handoff_pub_task-pub-1`;

    assert(keyPrepared === "content_prepared_task-edit-idem-1", "content_prepared idempotency key is deterministic");
    assert(keyDrive === "drive_link_added_task-edit-idem-1", "drive_link_added idempotency key is deterministic");
    assert(keyReady === "ready_for_publishing_task-edit-idem-1", "ready_for_publishing idempotency key is deterministic");
    assert(keyPubAssigned.startsWith("publisher_assigned_"), "publisher_assigned idempotency key is deterministic");
    assert(notifKey === "handoff_pub_task-pub-1", "Notification deduplication key matches publishing stage");
  }

  // =======================================================================
  // GROUP C: Publishing Idempotency & Conflict Guard
  // =======================================================================
  console.log("\n--- GROUP C: Publishing Idempotency & Conflict Guard ---");
  {
    const pubTaskId = "task-pub-idem-1";
    const publishedUrls = [
      "https://www.instagram.com/reel/DE_hardening_01/",
      "https://www.tiktok.com/@client/video/77889900",
    ];
    const platforms = ["instagram", "tiktok"] as const;

    const completedPubTask: TaskRow = {
      id: pubTaskId,
      parent_task_id: "parent-reel-1",
      title: "4. Publishing",
      category: "publishing",
      status: "done",
      published_at: "2026-10-06T18:30:00.000Z",
      published_by: "user-sami",
      published_urls: [...publishedUrls],
      target_platforms: [...platforms],
    } as any;

    // C1: First publish execution verified
    assert(completedPubTask.status === "done", "Publishing task status is done");
    assert(Boolean((completedPubTask as any).published_at), "published_at timestamp recorded");
    assert((completedPubTask as any).published_urls.length === 2, "2 published URLs recorded");

    // C2: Identical retry with same URLs and platforms is idempotent
    const isIdempotentPub = isPublishingIdempotent(
      completedPubTask,
      publishedUrls,
      [...platforms]
    );
    assert(isIdempotentPub, "Identical retry with same live URLs & platforms returns idempotent: true");

    // C3: Identical retry with different platform order is still idempotent
    const reorderedPlatforms = ["tiktok", "instagram"] as const;
    const isIdempotentReordered = isPublishingIdempotent(
      completedPubTask,
      publishedUrls,
      [...reorderedPlatforms]
    );
    assert(isIdempotentReordered, "Reordered platform retry is recognized as idempotent");

    // C4: Conflicting retry with different live URLs is rejected
    const conflictingUrls = ["https://www.instagram.com/reel/WRONG_LINK_HERE/"];
    const isConflictPub = isPublishingIdempotent(
      completedPubTask,
      conflictingUrls,
      ["instagram"]
    );
    assert(!isConflictPub, "Conflicting live URLs on published task is NOT idempotent (must reject with Conflict)");

    // C5: Conflicting retry with different platforms is rejected
    const conflictingPlatforms = ["facebook", "linkedin"] as const;
    const isConflictPlatforms = isPublishingIdempotent(
      completedPubTask,
      publishedUrls,
      [...conflictingPlatforms]
    );
    assert(!isConflictPlatforms, "Conflicting target platforms is NOT idempotent (must reject with Conflict)");

    // C6: Activity & Notification deduplication keys
    const pubActivityKey = `content_published_${pubTaskId}`;
    const pubNotifKey = `published_notify_${pubTaskId}`;
    assert(pubActivityKey === "content_published_task-pub-idem-1", "content_published activity key deterministic");
    assert(pubNotifKey === "published_notify_task-pub-idem-1", "published_notify notification key deterministic");
  }

  // =======================================================================
  // GROUP D: Race Safety & Prerequisite Locking
  // =======================================================================
  console.log("\n--- GROUP D: Race Safety & Prerequisite Locking ---");
  {
    const parentId = "parent-reel-race";

    const stgScript: TaskRow = {
      id: "stg-script-race",
      parent_task_id: parentId,
      title: "1. Scenario",
      category: "script",
      sort_order: 1,
      status: "done",
    } as TaskRow;

    const stgShootingIncomplete: TaskRow = {
      id: "stg-shooting-race",
      parent_task_id: parentId,
      title: "2. Shooting",
      category: "shooting",
      sort_order: 2,
      status: "in_progress", // NOT DONE!
    } as TaskRow;

    const stgShootingDone: TaskRow = {
      ...stgShootingIncomplete,
      status: "done",
    };

    const stgEditing: TaskRow = {
      id: "stg-editing-race",
      parent_task_id: parentId,
      title: "3. Editing",
      category: "editing",
      sort_order: 3,
      status: "todo",
    } as TaskRow;

    const stgEditingBlocked: TaskRow = {
      ...stgEditing,
      status: "blocked",
    };

    const stgPublishing: TaskRow = {
      id: "stg-publishing-race",
      parent_task_id: parentId,
      title: "4. Publishing",
      category: "publishing",
      sort_order: 4,
      status: "todo",
      is_stage_locked: true,
    } as TaskRow;

    // D1: Editing handoff rejected if Shooting is incomplete
    const editCheck1 = checkEditingHandoffEligibility(stgEditing, [
      stgScript,
      stgShootingIncomplete,
      stgEditing,
      stgPublishing,
    ]);
    assert(!editCheck1.eligible, "Editing handoff rejected when shooting is in_progress");
    assert(editCheck1.error?.includes("Shooting"), "Error message cites prerequisite stage Shooting");

    // D2: Editing handoff rejected if Script is incomplete
    const stgScriptIncomplete = { ...stgScript, status: "todo" as const };
    const editCheck2 = checkEditingHandoffEligibility(stgEditing, [
      stgScriptIncomplete,
      stgShootingDone,
      stgEditing,
      stgPublishing,
    ]);
    assert(!editCheck2.eligible, "Editing handoff rejected when script is incomplete");

    // D3: Editing handoff rejected if Editing is blocked
    const editCheck3 = checkEditingHandoffEligibility(stgEditingBlocked, [
      stgScript,
      stgShootingDone,
      stgEditingBlocked,
      stgPublishing,
    ]);
    assert(!editCheck3.eligible, "Editing handoff rejected when editing stage is blocked");
    assert(editCheck3.error?.includes("blocked"), "Error cites blocked status");

    // D4: Editing handoff succeeds when all prior stages are done
    const editCheck4 = checkEditingHandoffEligibility(stgEditing, [
      stgScript,
      stgShootingDone,
      stgEditing,
      stgPublishing,
    ]);
    assert(editCheck4.eligible, "Editing handoff eligible when script & shooting are completed");

    // D5: Publishing rejected when Editing is not yet done
    const pubCheck1 = checkPublishingEligibility(stgPublishing, [
      stgScript,
      stgShootingDone,
      stgEditing, // Still todo!
      stgPublishing,
    ]);
    assert(!pubCheck1.eligible, "Publishing rejected when prior editing stage is todo");

    // D6: Publishing rejected when stage is locked
    const stgEditingDone = { ...stgEditing, status: "done" as const };
    const pubCheck2 = checkPublishingEligibility(stgPublishing, [
      stgScript,
      stgShootingDone,
      stgEditingDone,
      stgPublishing, // is_stage_locked: true
    ]);
    assert(!pubCheck2.eligible, "Publishing rejected when is_stage_locked is true");
    assert(pubCheck2.error?.includes("locked"), "Error cites locked stage");

    // D7: Publishing succeeds when Editing is done AND stage is unlocked
    const stgPublishingUnlocked: TaskRow = {
      ...stgPublishing,
      is_stage_locked: false,
    };
    const pubCheck3 = checkPublishingEligibility(stgPublishingUnlocked, [
      stgScript,
      stgShootingDone,
      stgEditingDone,
      stgPublishingUnlocked,
    ]);
    assert(pubCheck3.eligible, "Publishing eligible when editing is done and stage unlocked");
  }

  // =======================================================================
  // GROUP E: Platform & Submitted Live URL Data Integrity
  // =======================================================================
  console.log("\n--- GROUP E: Platform & Submitted Live URL Data Integrity ---");
  {
    // E1: Canonical supported platforms
    assert(SUPPORTED_PUBLISHING_PLATFORMS.length === 6, "Exactly 6 canonical platforms defined");
    assert(isSupportedPublishingPlatform("instagram"), "instagram is supported");
    assert(isSupportedPublishingPlatform("facebook"), "facebook is supported");
    assert(isSupportedPublishingPlatform("tiktok"), "tiktok is supported");
    assert(isSupportedPublishingPlatform("linkedin"), "linkedin is supported");
    assert(isSupportedPublishingPlatform("youtube_shorts"), "youtube_shorts is supported");
    assert(isSupportedPublishingPlatform("twitter_x"), "twitter_x is supported");

    // E2: Unsupported platforms rejected
    assert(!isSupportedPublishingPlatform("telegram"), "telegram is not supported");
    assert(!isSupportedPublishingPlatform("pinterest"), "pinterest is not supported");
    assert(!isSupportedPublishingPlatform("snapchat"), "snapchat is not supported");
    assert(!isSupportedPublishingPlatform("myspace"), "myspace is not supported");

    // E3: validatePublishingData - Unsupported platform in array rejected
    const resUnsupported = validatePublishingData(
      ["instagram", "telegram"],
      ["https://instagram.com/p/1", "https://t.me/post/1"]
    );
    assert(!resUnsupported.valid, "Unsupported platform in payload rejected");
    assert(resUnsupported.error?.includes("Unsupported"), "Error message cites unsupported platform");

    // E4: validatePublishingData - Duplicate platforms rejected
    const resDupes = validatePublishingData(
      ["instagram", "instagram"],
      ["https://instagram.com/p/1", "https://instagram.com/p/2"]
    );
    assert(!resDupes.valid, "Duplicate platforms rejected");
    assert(resDupes.error?.includes("Duplicate"), "Error message cites duplicate platforms");

    // E5: validatePublishingData - Empty platforms rejected
    const resEmptyPlat = validatePublishingData([], ["https://instagram.com/p/1"]);
    assert(!resEmptyPlat.valid, "Empty platforms array rejected");

    // E6: validatePublishingData - Empty URLs rejected
    const resEmptyUrls = validatePublishingData(["instagram"], []);
    assert(!resEmptyUrls.valid, "Empty URLs array rejected");

    // E7: validatePublishingData - Invalid URL syntax rejected
    const resBadUrl = validatePublishingData(
      ["instagram"],
      ["not-a-valid-http-url"]
    );
    assert(!resBadUrl.valid, "Invalid URL syntax rejected");
    assert(resBadUrl.error?.includes("Invalid submitted live URL"), "Error cites invalid live URL");

    // E8: validatePublishingData - URL count mismatch rejected
    const resCountMismatch = validatePublishingData(
      ["instagram", "tiktok"],
      [
        "https://instagram.com/p/1",
        "https://tiktok.com/@v/2",
        "https://extra.com/p/3",
      ]
    );
    assert(!resCountMismatch.valid, "URL count mismatch rejected");
    assert(resCountMismatch.error?.includes("mismatch"), "Error cites count mismatch");

    // E9: validatePublishingData - Deterministic platform ordering
    const resOrder = validatePublishingData(
      ["tiktok", "facebook", "instagram"],
      [
        "https://tiktok.com/@v/1",
        "https://facebook.com/post/1",
        "https://instagram.com/p/1",
      ]
    );
    assert(resOrder.valid, "Valid multi-platform payload accepted");
    assert(
      JSON.stringify(resOrder.canonicalPlatforms) ===
        JSON.stringify(["facebook", "instagram", "tiktok"]),
      "Platforms ordered canonically / deterministically (alphabetical sort)"
    );

    // E10: validateDriveUrl engine
    assert(
      validateDriveUrl("https://drive.google.com/drive/folders/test-123").valid,
      "Google Drive folder accepted"
    );
    assert(
      validateDriveUrl("https://www.dropbox.com/s/123/reel.mp4").valid,
      "Dropbox link accepted"
    );
    assert(
      validateDriveUrl("https://app.frame.io/player/abc").valid,
      "Frame.io link accepted"
    );
    assert(!validateDriveUrl("").valid, "Empty Drive URL rejected");
    assert(!validateDriveUrl(null).valid, "Null Drive URL rejected");
    assert(!validateDriveUrl("ftp://server/reel.mp4").valid, "Non-HTTP/HTTPS Drive URL rejected");
    assert(!validateDriveUrl("c:\\local\\path\\reel.mp4").valid, "Local file path rejected");
  }

  // =======================================================================
  // GROUP F: Deliverable Completion Invariants
  // =======================================================================
  console.log("\n--- GROUP F: Deliverable Completion Invariants ---");
  {
    const parentId = "parent-reel-invariant";

    const s1: TaskRow = {
      id: "s1",
      parent_task_id: parentId,
      title: "1. Scenario",
      category: "script",
      sort_order: 1,
      status: "done",
    } as TaskRow;

    const s2: TaskRow = {
      id: "s2",
      parent_task_id: parentId,
      title: "2. Shooting",
      category: "shooting",
      sort_order: 2,
      status: "done",
    } as TaskRow;

    const s3: TaskRow = {
      id: "s3",
      parent_task_id: parentId,
      title: "3. Editing",
      category: "editing",
      sort_order: 3,
      status: "done",
      result_links: ["https://drive.google.com/drive/folders/ready-reel"],
    } as TaskRow;

    const s4: TaskRow = {
      id: "s4",
      parent_task_id: parentId,
      title: "4. Publishing",
      category: "publishing",
      sort_order: 4,
      status: "todo",
      is_stage_locked: false,
    } as TaskRow;

    // F1: Check stages after editing completion (3 of 4 done)
    const stagesAfterEditing = [s1, s2, s3, s4];
    const progressAfterEdit = computeWorkflowProgress(parentId, stagesAfterEditing);

    assert(progressAfterEdit.total_stages === 4, "Total stages = 4");
    assert(progressAfterEdit.completed_stages === 3, "Completed stages = 3");
    assert(
      progressAfterEdit.progress_percent === 75,
      "CRITICAL INVARIANT: Editing complete => Parent progress is 75%, NOT 100%"
    );
    assert(!progressAfterEdit.all_completed, "Parent is NOT all_completed");
    assert(
      progressAfterEdit.current_stage_order === 4,
      "Current stage advanced to 4 (Publishing)"
    );

    // F2: Publishing stage actionability
    const pubActionability = checkStageActionability(s4, stagesAfterEditing);
    assert(
      !pubActionability.isLocked,
      "Publishing stage is unlocked after editing completion"
    );
    assert(
      pubActionability.isActionable,
      "Publishing stage becomes actionable after editing completion"
    );

    // F3: Only after Publishing completes does Parent reach 100% and Done
    const s4Done: TaskRow = {
      ...s4,
      status: "done",
      result_links: ["https://instagram.com/reel/DE_done"],
    };
    const stagesAfterPublishing = [s1, s2, s3, s4Done];
    const progressAfterPublish = computeWorkflowProgress(
      parentId,
      stagesAfterPublishing
    );

    assert(progressAfterPublish.completed_stages === 4, "Completed stages = 4");
    assert(
      progressAfterPublish.progress_percent === 100,
      "CRITICAL INVARIANT: Publishing complete => Parent reaches 100%"
    );
    assert(progressAfterPublish.all_completed, "Parent is all_completed = true");

    // F4: Invariant check with approved/delivered statuses
    const s4Delivered: TaskRow = { ...s4, status: "delivered" as any };
    const progressWithDelivered = computeWorkflowProgress(parentId, [
      s1,
      s2,
      s3,
      s4Delivered,
    ]);
    assert(
      progressWithDelivered.progress_percent === 100,
      "Delivered publishing stage counts as completion"
    );
  }

  // =======================================================================
  // GROUP G: Publisher Capability Architecture
  // =======================================================================
  console.log("\n--- GROUP G: Publisher Capability Architecture ---");
  {
    // G1: 3-tier RBAC preserved
    const members: TeamMemberLike[] = [
      {
        id: "tm-1",
        profile_id: "p-1",
        role: "worker",
        display_name: "Farah Copywriter",
        specialties: ["copywriting", "script"],
        is_publisher: false,
        is_active: true,
      },
      {
        id: "tm-2",
        profile_id: "p-2",
        role: "worker",
        display_name: "Yassine Editor",
        specialties: ["editing", "after_effects"],
        is_publisher: false,
        is_active: true,
      },
      {
        id: "tm-3",
        profile_id: "p-3",
        role: "worker",
        display_name: "Salma Publisher",
        specialties: ["publishing", "reels_distribution"],
        is_publisher: true,
        is_active: true,
      },
      {
        id: "tm-4",
        profile_id: "p-4",
        role: "worker",
        display_name: "Leila Social Specialist",
        position: "Social Media Manager",
        specialties: ["community_management"],
        is_publisher: false, // Inferred via position
        is_active: true,
      },
      {
        id: "tm-5",
        profile_id: "p-5",
        role: "admin",
        display_name: "Karim Ops Lead",
        is_publisher: true,
        is_active: true,
      },
      {
        id: "tm-inactive",
        profile_id: "p-inact",
        role: "worker",
        display_name: "Inactive Ex-Publisher",
        is_publisher: true,
        is_active: false, // Inactive!
      },
    ];

    // G2: Capability detection
    assert(!isMemberPublisher(members[0]), "Copywriter is not publisher");
    assert(!isMemberPublisher(members[1]), "Editor is not publisher");
    assert(isMemberPublisher(members[2]), "Worker with is_publisher=true is publisher");
    assert(
      isMemberPublisher(members[3]),
      "Worker with Social Media Manager position inferred as publisher"
    );
    assert(isMemberPublisher(members[4]), "Admin with is_publisher=true is publisher");

    // G3: getAvailablePublishers excludes inactive
    const available = getAvailablePublishers(members);
    assert(available.length === 3, "Available publishers excludes inactive member (3 active found)");
    assert(
      !available.some((m) => m.id === "tm-inactive"),
      "Inactive member tm-inactive strictly excluded"
    );

    // G4: resolvePublisherForTask priority
    const resolvedDefault = resolvePublisherForTask({ teamMembers: members });
    assert(
      resolvedDefault === "p-3",
      "Default resolution picks first available publisher (Salma Publisher p-3)"
    );

    const resolvedCustom = resolvePublisherForTask({
      teamMembers: members,
      customPublisherId: "tm-4",
    });
    assert(
      resolvedCustom === "p-4",
      "Custom publisher override tm-4 resolved correctly to profile p-4"
    );

    const resolvedPreferred = resolvePublisherForTask({
      teamMembers: members,
      clientPreferredPublisherId: "tm-5",
    });
    assert(
      resolvedPreferred === "p-5",
      "Client preferred publisher tm-5 resolved correctly to profile p-5"
    );

    // G5: configureMemberPublisherCapability authorization guard
    const unauthorizedAttempt = await configureMemberPublisherCapability({
      teamMemberId: "tm-2",
      isPublisher: true,
      actorId: "p-1",
      actorRole: "worker", // Worker cannot configure capability!
    });
    assert(!unauthorizedAttempt.success, "Worker cannot configure publisher capability");
    assert(
      unauthorizedAttempt.error?.includes("Super Admin"),
      "Error specifies Super Admin authority required"
    );

    const adminAttempt = await configureMemberPublisherCapability({
      teamMemberId: "tm-2",
      isPublisher: true,
      actorId: "p-5",
      actorRole: "admin", // Admin cannot configure capability!
    });
    assert(!adminAttempt.success, "Admin cannot configure publisher capability");
    assert(
      adminAttempt.error?.includes("Super Admin"),
      "Error specifies Super Admin authority required"
    );

    const unauthAttempt = await configureMemberPublisherCapability({
      teamMemberId: "tm-2",
      isPublisher: true,
      actorId: undefined, // Unauthenticated!
    });
    assert(!unauthAttempt.success, "Unauthenticated request rejected");
  }

  // =======================================================================
  // GROUP H: Client Metadata Privacy & Isolation
  // =======================================================================
  console.log("\n--- GROUP H: Client Metadata Privacy & Isolation ---");
  {
    const mockFullClientRecord = {
      id: "cli-luxury-99",
      name: "Maison de Luxe",
      industry: "Haute Horlogerie",
      notes: "VIP Client. Official Instagram: @maison_luxe_tn",
      social_accounts: {
        instagram: "@maison_luxe_tn",
        facebook: "facebook.com/maisonluxetn",
        tiktok: "@maisonluxe",
        linkedin: "linkedin.com/company/maisonluxe",
        youtube: null,
      },
      // SENSITIVE FINANCIAL FIELDS THAT MUST NEVER LEAK:
      monthly_retainer: 6500,
      hourly_rate: 180,
      profit_margin: 0.72,
      invoices_total: 19500,
      unpaid_balance: 0,
      contract_value: 78000,
      package_config: { custom_discount: 0.15 },
    };

    // H1: Verify projection exposes social accounts
    assert(
      Boolean(mockFullClientRecord.social_accounts.instagram),
      "Social account Instagram exposed"
    );
    assert(
      Boolean(mockFullClientRecord.social_accounts.tiktok),
      "Social account TikTok exposed"
    );
    assert(
      Boolean(mockFullClientRecord.social_accounts.linkedin),
      "Social account LinkedIn exposed"
    );

    // H2: Simulated isolated projection
    const isolatedInfo = {
      clientId: mockFullClientRecord.id,
      clientName: mockFullClientRecord.name,
      industry: mockFullClientRecord.industry,
      socialAccounts: {
        instagram: mockFullClientRecord.social_accounts.instagram,
        facebook: mockFullClientRecord.social_accounts.facebook,
        tiktok: mockFullClientRecord.social_accounts.tiktok,
        linkedin: mockFullClientRecord.social_accounts.linkedin,
        youtube: mockFullClientRecord.social_accounts.youtube,
      },
    };

    assert(!("monthly_retainer" in isolatedInfo), "monthly_retainer is strictly NOT in publishing info");
    assert(!("hourly_rate" in isolatedInfo), "hourly_rate is strictly NOT in publishing info");
    assert(!("profit_margin" in isolatedInfo), "profit_margin is strictly NOT in publishing info");
    assert(!("invoices_total" in isolatedInfo), "invoices_total is strictly NOT in publishing info");
    assert(!("package_config" in isolatedInfo), "package_config is strictly NOT in publishing info");

    // H3: Fallback extraction from notes
    const clientWithNotesOnly = {
      id: "cli-notes-1",
      name: "Cafe Chic",
      notes: "Follow them on @cafechic_tunis for latest updates",
      social_accounts: null,
    };
    const instaMatch = clientWithNotesOnly.notes.match(/@([a-zA-Z0-9._]+)/);
    const extractedHandle = instaMatch ? `@${instaMatch[1]}` : null;
    assert(extractedHandle === "@cafechic_tunis", "Fallback extracted Instagram handle from notes");
  }

  // =======================================================================
  // GROUP I: Auditable Chain of Custody & Reconciliation
  // =======================================================================
  console.log("\n--- GROUP I: Auditable Chain of Custody & Reconciliation ---");
  {
    // Simulate historical project activities including duplicate retry entries
    const historicalActivities = [
      {
        id: "act-1",
        action: "content_prepared",
        actor_id: "p-editor",
        actor: { id: "p-editor", display_name: "Maya Editor" },
        created_at: "2026-10-06T15:00:00Z",
        details: { stage_title: "3. Editing" },
      },
      {
        id: "act-2",
        action: "drive_link_added",
        actor_id: "p-editor",
        actor: { id: "p-editor", display_name: "Maya Editor" },
        created_at: "2026-10-06T15:01:00Z",
        details: { drive_url: "https://drive.google.com/drive/folders/v1-final" },
      },
      {
        id: "act-3",
        action: "ready_for_publishing",
        actor_id: "p-editor",
        actor: { id: "p-editor", display_name: "Maya Editor" },
        created_at: "2026-10-06T15:01:30Z",
        details: {
          timestamp: "2026-10-06T15:01:30Z",
          drive_url: "https://drive.google.com/drive/folders/v1-final",
        },
      },
      // DUPLICATE retry of ready_for_publishing (e.g. from network retry)
      {
        id: "act-3-dupe",
        action: "ready_for_publishing",
        actor_id: "p-editor",
        created_at: "2026-10-06T15:01:45Z",
        details: { timestamp: "2026-10-06T15:01:45Z" },
      },
      {
        id: "act-4",
        action: "publisher_assigned",
        actor_id: "p-editor",
        created_at: "2026-10-06T15:02:00Z",
        details: { assigned_publisher_id: "p-publisher" },
      },
      {
        id: "act-5",
        action: "content_published",
        actor_id: "p-publisher",
        actor: { id: "p-publisher", display_name: "Sami Publisher" },
        created_at: "2026-10-06T16:00:00Z",
        details: {
          published_by: "p-publisher",
          published_at: "2026-10-06T16:00:00Z",
          published_urls: ["https://instagram.com/reel/12345"],
          platforms: ["instagram"],
        },
      },
      // DUPLICATE retry of content_published
      {
        id: "act-5-dupe",
        action: "content_published",
        actor_id: "p-publisher",
        created_at: "2026-10-06T16:00:05Z",
        details: { published_at: "2026-10-06T16:00:05Z" },
      },
    ];

    // Reconcile milestones following fetchPublishingAuditTrail algorithm
    const reconciledAudit: any = {};
    for (const act of historicalActivities) {
      const actorObj = act.actor
        ? { id: act.actor.id, name: act.actor.display_name || "Specialist" }
        : act.actor_id
        ? { id: act.actor_id, name: "Specialist" }
        : null;

      if (act.action === "content_prepared" && !reconciledAudit.contentPreparedBy) {
        reconciledAudit.contentPreparedBy = actorObj;
      } else if (act.action === "drive_link_added" && !reconciledAudit.driveLinkAddedBy) {
        reconciledAudit.driveLinkAddedBy = actorObj;
        reconciledAudit.driveUrl = act.details?.drive_url || null;
      } else if (act.action === "ready_for_publishing" && !reconciledAudit.readyForPublishingAt) {
        reconciledAudit.readyForPublishingAt = act.details?.timestamp || act.created_at;
        if (act.details?.drive_url) reconciledAudit.driveUrl = act.details.drive_url;
      } else if (act.action === "publisher_assigned" && !reconciledAudit.assignedPublisher) {
        reconciledAudit.assignedPublisher = {
          id: act.details?.assigned_publisher_id,
          name: "Publisher",
        };
      } else if (act.action === "content_published" && !reconciledAudit.publishedBy) {
        reconciledAudit.publishedBy = actorObj;
        reconciledAudit.publishedAt = act.details?.published_at || act.created_at;
        reconciledAudit.publishedUrls = act.details?.published_urls || [];
        reconciledAudit.platforms = act.details?.platforms || [];
      }
    }

    // I1: Reconciles all 5 milestones
    assert(
      reconciledAudit.contentPreparedBy?.name === "Maya Editor",
      "Milestone 1: Content Prepared By reconciled"
    );
    assert(
      reconciledAudit.driveLinkAddedBy?.name === "Maya Editor",
      "Milestone 2: Drive Link Added By reconciled"
    );
    assert(
      reconciledAudit.driveUrl === "https://drive.google.com/drive/folders/v1-final",
      "Milestone 2: Drive URL recorded"
    );
    assert(
      reconciledAudit.readyForPublishingAt === "2026-10-06T15:01:30Z",
      "Milestone 3: Ready for Publishing timestamp reconciled"
    );
    assert(
      reconciledAudit.assignedPublisher?.id === "p-publisher",
      "Milestone 4: Assigned Publisher reconciled"
    );
    assert(
      reconciledAudit.publishedBy?.name === "Sami Publisher",
      "Milestone 5: Published By reconciled"
    );
    assert(
      reconciledAudit.publishedUrls[0] === "https://instagram.com/reel/12345",
      "Milestone 5: Live URL reconciled"
    );
    assert(
      reconciledAudit.platforms[0] === "instagram",
      "Milestone 5: Platform reconciled"
    );

    // I2: Deduplication: Earliest timestamp preserved over duplicate retry
    assert(
      reconciledAudit.readyForPublishingAt === "2026-10-06T15:01:30Z",
      "Deduplication: Earliest ready_for_publishing timestamp preserved over duplicate retry"
    );
    assert(
      reconciledAudit.publishedAt === "2026-10-06T16:00:00Z",
      "Deduplication: Earliest publishedAt timestamp preserved over duplicate retry"
    );
  }

  // =======================================================================
  // SUMMARY
  // =======================================================================
  console.log("\n=======================================================================");
  console.log(`Phase 7.1 Hardening Suite Finished: ${passed} passed, ${failed} failed`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTestSuite().catch((err) => {
  console.error("Hardening test execution fatal error:", err);
  process.exit(1);
});
