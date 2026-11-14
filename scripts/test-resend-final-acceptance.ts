// ============================================================
// SADA OS — RESEND EMAIL FINAL ACCEPTANCE & UX REFINEMENT TEST
// Comprehensive End-to-End Verification Suite
// 10 Dedicated Templates · Timezone (Africa/Tunis) · Human Dates
// Assigner Name Display · Universal Worker Acknowledgment Engine
// Delivery Reliability · Webhook Signature Security · Zero Leaks
// ============================================================

import path from "path";
import fs from "fs";

// Load environment from .env and .env.local without external dotenv dependency
function loadEnvFile(fileName: string) {
  try {
    const envPath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_) {}
}

loadEnvFile(".env");
loadEnvFile(".env.local");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  dispatchEmailNotification,
  getResendClient,
  handleResendWebhook,
  verifyWebhookSignature,
} from "../src/server/email-dispatcher";
import {
  renderNotificationEmail,
  formatSadaEmailDateTime,
  SADA_TIMEZONE,
  resolveActionUrl,
  escapeHtml,
} from "../src/server/email-templates";
import { acknowledgeTaskAssignment } from "../src/lib/task-execution-service";
import type { NotificationEventType, NotificationItem } from "../src/types/notifications-and-audit";

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, description: string, detail?: any) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${description}`);
    if (detail !== undefined) {
      console.error("     Detail:", typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail);
    }
  }
}

async function runFinalAcceptanceSuite() {
  console.log("\n============================================================");
  console.log("   SADA OS — RESEND EMAIL FINAL ACCEPTANCE & UX AUDIT   ");
  console.log("============================================================\n");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || "boubakarhamedsgail@gmail.com";
  const adminPass = process.env.SYSTEM_ADMIN_PASSWORD;

  if (!adminPass) {
    console.error("❌ Fatal: SYSTEM_ADMIN_PASSWORD missing from environment.");
    process.exit(1);
  }
  if (!supabaseUrl || !anonKey) {
    console.error("❌ Fatal: Supabase URL or Anon key missing.");
    process.exit(1);
  }

  // Authenticate Admin client
  const adminAuthClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authErr } = await adminAuthClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass,
  });

  if (authErr || !authData.session?.access_token) {
    console.error("❌ Fatal: Authentication failed:", authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const adminUserId = authData.user.id;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  console.log(`🔑 Test Authenticated as Super Admin: ${adminEmail} (${adminUserId})\n`);

  // ============================================================
  // STAGE 1: Timezone & Human-Readable Date Formatting
  // ============================================================
  console.log("--- STAGE 1: SADA Timezone & Human-Readable Date Formatting ---");

  assert(SADA_TIMEZONE === "Africa/Tunis", `Configured timezone is Africa/Tunis (actual: ${SADA_TIMEZONE})`);

  const rawIso1 = "2026-11-16T18:00:00.000Z";
  const formatted1 = formatSadaEmailDateTime(rawIso1);
  assert(
    !formatted1.includes("T18:00:00") && !formatted1.includes(".000Z"),
    "Raw ISO timestamp replaced with human string (no raw T or .000Z)",
    formatted1
  );
  assert(
    formatted1.includes("16 Nov 2026") && formatted1.includes("19:00"),
    "UTC timestamp 18:00 accurately converted to Tunis Time (UTC+1: 19:00)",
    formatted1
  );
  assert(
    formatted1.includes("CET") || formatted1.includes("GMT+1"),
    "Timezone indicator CET or GMT+1 is present",
    formatted1
  );

  const dateOnlyStr = "2026-11-20";
  const formattedDateOnly = formatSadaEmailDateTime(dateOnlyStr, { includeTime: false });
  assert(
    formattedDateOnly.includes("20 Nov 2026"),
    "Date-only input formatted cleanly without time shifting",
    formattedDateOnly
  );

  const humanProse = "Immediate (Action Required)";
  const formattedProse = formatSadaEmailDateTime(humanProse);
  assert(
    formattedProse === humanProse,
    "Non-date human prose preserved without distortion",
    formattedProse
  );

  // ============================================================
  // STAGE 2: 10 Operational & System Email Templates Audit
  // ============================================================
  console.log("\n--- STAGE 2: 10 Operational & System Templates Verification ---");

  const testBaseParams = {
    notificationId: "notif_audit_001",
    linkUrl: "/admin/my-work?taskId=task_audit_001",
    contextTitle: "Hermès Paris Campaign",
    baseUrl: "https://sada.agency",
  };

  // 1. Task Assigned
  const t1 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "TASK_ASSIGNED",
    title: "Task Assigned: 4K Color Grading Deliverable",
    message: "Final grading for commercial reel delivery.",
    metadata: {
      taskTitle: "4K Color Grading Deliverable",
      clientName: "Hermès Paris",
      deadline: "2026-11-18T17:00:00Z",
      assignedByName: "Boubakar Hamed (Creative Director)",
      priority: "urgent",
      description: "Deliver Prores 4444 master reel.",
    },
  });
  assert(t1.templateId === "task_assigned_v1", "Template 1: Task Assigned maps to task_assigned_v1");
  assert(t1.html.includes("Boubakar Hamed (Creative Director)"), "Template 1: Displays actual assigner's name");
  assert(!t1.html.includes("2026-11-18T17:00:00Z"), "Template 1: Replaces raw ISO deadline with formatted date");
  assert(t1.html.includes("18 Nov 2026"), "Template 1: Human-readable deadline formatted");
  assert(t1.html.includes("ack=1"), "Template 1: CTA deep link includes mandatory ack=1 param");
  assert(t1.html.includes("does not constitute official acknowledgment"), "Template 1: Mandatory acknowledgment notice present");

  // 2. Deadline Reminder (Due Soon)
  const t2 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "TASK_DUE_SOON",
    title: "Due Soon: Social Media Cutdown",
    message: "Approaching deadline within 24 hours.",
    metadata: {
      taskTitle: "Social Media Cutdown",
      deadline: "2026-11-15T12:00:00Z",
    },
  });
  assert(t2.templateId === "deadline_reminder_v1", "Template 2: Deadline Reminder maps to deadline_reminder_v1");
  assert(!t2.html.includes("2026-11-15T12:00:00Z"), "Template 2: Replaces raw ISO with formatted deadline");
  assert(t2.html.includes("ack=1"), "Template 2: CTA includes ack=1");
  assert(t2.html.includes("does not constitute official acknowledgment"), "Template 2: Acknowledgment notice present");

  // 3. Overdue Task
  const t3 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "TASK_OVERDUE",
    title: "Overdue: Sound Design Master",
    message: "Scheduled delivery window elapsed.",
    metadata: {
      taskTitle: "Sound Design Master",
      deadline: "2026-11-13T10:00:00Z",
    },
  });
  assert(t3.templateId === "deadline_reminder_v1", "Template 3: Overdue maps to deadline_reminder_v1");
  assert(t3.subject.includes("[SADA OVERDUE]"), "Template 3: Subject includes [SADA OVERDUE]");
  assert(t3.html.includes("ack=1"), "Template 3: CTA includes ack=1");

  // 4. Revision Requested
  const t4 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "TASK_REVISION_REQUESTED",
    title: "Revisions Requested: Typography Motion",
    message: "Please adjust tracking on title sequence.",
    metadata: {
      taskTitle: "Typography Motion",
      reviewerName: "Art Director",
      feedback: "Tracking too tight on serif headline.",
    },
  });
  assert(t4.templateId === "revision_requested_v1", "Template 4: Revisions map to revision_requested_v1");
  assert(t4.html.includes("Art Director"), "Template 4: Displays reviewer name");
  assert(t4.html.includes("ack=1"), "Template 4: CTA includes ack=1");
  assert(t4.html.includes("does not constitute official acknowledgment"), "Template 4: Acknowledgment notice present");

  // 5. Comment / Mention
  const t5 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "USER_MENTIONED",
    title: "Mentioned in Production Chat",
    message: "@Boubakar can you check the anamorphic ratio?",
    metadata: {
      authorName: "Lead Cinematographer",
      commentText: "Ratio looks letterboxed at 2.39:1 instead of 2.0:1.",
    },
  });
  assert(t5.templateId === "comment_mention_v1", "Template 5: Mention maps to comment_mention_v1");
  assert(t5.html.includes("Lead Cinematographer"), "Template 5: Displays author name");
  assert(t5.html.includes("ack=1"), "Template 5: CTA includes ack=1");

  // 6. Client Action Required
  const t6 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "CLIENT_APPROVAL_REQUIRED",
    title: "Client Sign-off Required: Moodboard",
    message: "Awaiting brand director sign-off.",
    metadata: {
      clientName: "Rolex Middle East",
      actionNeeded: "Approve visual style frames",
      deadline: "2026-11-17T15:00:00Z",
    },
  });
  assert(t6.templateId === "client_action_v1", "Template 6: Client Action maps to client_action_v1");
  assert(t6.html.includes("Rolex Middle East"), "Template 6: Displays client name");
  assert(!t6.html.includes("2026-11-17T15:00:00Z"), "Template 6: Replaces raw ISO deadline");
  assert(t6.html.includes("ack=1"), "Template 6: CTA includes ack=1");

  // 7. Task Review Requested
  const t7 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "TASK_REVIEW_REQUESTED",
    title: "QA Sign-off Required: VFX Comp",
    message: "Compositing pass 2 ready for review.",
    metadata: {
      taskTitle: "VFX Comp Pass 2",
      workerName: "Senior Compositor",
      submittedAt: "2026-11-14T14:30:00Z",
    },
  });
  assert(t7.templateId === "task_review_v1", "Template 7: Task Review maps to task_review_v1");
  assert(t7.html.includes("Senior Compositor"), "Template 7: Displays worker name");
  assert(!t7.html.includes("2026-11-14T14:30:00Z"), "Template 7: Replaces raw ISO submittedAt");
  assert(t7.html.includes("ack=1"), "Template 7: CTA includes ack=1");

  // 8. Account Security Alert
  const t8 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "SECURITY_AUDIT",
    title: "New Session Authorized from Tunis",
    message: "A new browser session logged into your account.",
    metadata: {
      timestamp: "2026-11-14T16:15:00Z",
      guidance: "If this was not you, change your password immediately.",
    },
  });
  assert(t8.templateId === "account_security_v1", "Template 8: Security Alert maps to account_security_v1");
  assert(!t8.html.includes("2026-11-14T16:15:00Z"), "Template 8: Replaces raw ISO timestamp");
  assert(t8.html.includes("Review Security Center"), "Template 8: Security CTA button present");

  // 9. Billing & Finance Event
  const t9 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "INVOICE_OVERDUE",
    title: "Invoice Past Due: INV-2026-0042",
    message: "Payment reminder for retained creative services.",
    metadata: {
      clientName: "Cartier Joaillerie",
      invoiceNumber: "INV-2026-0042",
      amount: "14,500",
      dueDate: "2026-11-10",
    },
  });
  assert(t9.templateId === "billing_finance_v1", "Template 9: Finance maps to billing_finance_v1");
  assert(t9.html.includes("INV-2026-0042"), "Template 9: Displays invoice number");
  assert(t9.html.includes("10 Nov 2026"), "Template 9: Formatted due date");
  assert(t9.html.includes("ack=1"), "Template 9: CTA includes ack=1");

  // 10. Production & Calendar Event
  const t10 = renderNotificationEmail({
    ...testBaseParams,
    eventType: "PRODUCTION_TOMORROW",
    title: "Shoot Tomorrow: Studio Commercial",
    message: "Equipment call time 07:30 sharp.",
    metadata: {
      shootTitle: "Studio Commercial Shoot",
      clientName: "SADA Digital Luxe",
      date: "2026-11-15",
      time: "07:30 AM",
      location: "Studio SADA Tunis",
    },
  });
  assert(t10.templateId === "production_calendar_v1", "Template 10: Production maps to production_calendar_v1");
  assert(t10.html.includes("Studio SADA Tunis"), "Template 10: Displays shoot location");
  assert(t10.html.includes("15 Nov 2026"), "Template 10: Formatted shoot date");
  assert(t10.html.includes("ack=1"), "Template 10: CTA includes ack=1");

  // Responsive & Overflow Verification
  assert(t1.html.includes("table-layout: fixed"), "Email layout enforces table-layout: fixed to prevent overflow");
  assert(t1.html.includes("word-break: break-word"), "Email headings & body enforce word-break: break-word");
  assert(t1.html.includes("max-width: 600px"), "Email container bounded to 600px max width");

  // ============================================================
  // STAGE 3: Universal Worker Acknowledgment Engine Audit
  // ============================================================
  console.log("\n--- STAGE 3: Universal Worker Acknowledgment Engine Audit ---");

  // 3.0 Resolve active client & client_project for foreign key constraint
  const { data: existingClient } = await (client as any).from("clients").select("id").limit(1).maybeSingle();
  let testClientId = existingClient?.id;
  if (!testClientId) {
    const { data: newC } = await (client as any).from("clients").insert({ name: "Final Acceptance Client" }).select("id").single();
    testClientId = newC?.id;
  }

  const { data: existingCp } = await (client as any).from("client_projects").select("id").limit(1).maybeSingle();
  let testProjectId = existingCp?.id;
  if (!testProjectId) {
    const { data: newCp } = await (client as any)
      .from("client_projects")
      .insert({ title: "Final Acceptance Project", client_name: "Final Acceptance Client", status: "active" })
      .select("id")
      .single();
    testProjectId = newCp?.id;
  }

  // 3.1 Create a dedicated test task
  const { data: testTask, error: taskCreateErr } = await (client as any)
    .from("project_tasks")
    .insert({
      title: "E2E Final Acceptance Deliverable Task",
      project_id: testProjectId,
      client_id: testClientId,
      status: "todo",
      priority: "high",
      assignee_id: adminUserId, // assigned to Super Admin
      deadline: "2026-11-25T18:00:00Z",
    })
    .select("id, title, project_id, assignee_id")
    .single();

  assert(!taskCreateErr && Boolean(testTask?.id), "Created deterministic test task in project_tasks", taskCreateErr?.message || testTask?.id);

  // 3.2 Create associated notification
  const { data: testNotif, error: notifCreateErr } = await (client as any)
    .from("notifications")
    .insert({
      user_id: adminUserId,
      event_type: "TASK_ASSIGNED",
      title: "Task Assigned: E2E Final Acceptance Deliverable",
      message: "Please review and acknowledge assignment.",
      category: "task",
      priority: "high",
      entity_type: "task",
      entity_id: testTask.id,
      link_url: `/admin/my-work?taskId=${testTask.id}`,
      metadata: {
        taskId: testTask.id,
        taskTitle: testTask.title,
      },
    })
    .select("id, metadata")
    .single();

  assert(!notifCreateErr && Boolean(testNotif?.id), "Created associated test notification", testNotif?.id);

  // 3.3 Test 1: Authenticated worker acknowledges assignment
  const ack1Success = await acknowledgeTaskAssignment({
    taskId: testTask.id,
    actorId: adminUserId,
    notificationId: testNotif.id,
    client,
  });
  assert(ack1Success === true, "Assigned worker successfully recorded authenticated acknowledgment");

  // Verify record in project_activity
  const { data: ackActivity } = await (client as any)
    .from("project_activity")
    .select("id, action, actor_id, created_at, details")
    .eq("task_id", testTask.id)
    .eq("action", "task_acknowledged");

  assert(
    Array.isArray(ackActivity) && ackActivity.length === 1,
    "Exactly 1 'task_acknowledged' row inserted into project_activity",
    ackActivity?.length
  );
  assert(
    ackActivity?.[0]?.actor_id === adminUserId,
    "Activity row stores authenticated worker's actor_id",
    ackActivity?.[0]?.actor_id
  );

  // Verify notification metadata updated
  const { data: updatedNotif } = await (client as any)
    .from("notifications")
    .select("read, metadata")
    .eq("id", testNotif.id)
    .single();

  assert(
    updatedNotif?.read === true,
    "Notification marked read upon worker acknowledgment",
    updatedNotif?.read
  );
  assert(
    Boolean(updatedNotif?.metadata?.worker_acknowledged_at),
    "Notification metadata records worker_acknowledged_at timestamp",
    updatedNotif?.metadata?.worker_acknowledged_at
  );
  assert(
    updatedNotif?.metadata?.worker_acknowledged_by === adminUserId,
    "Notification metadata records worker_acknowledged_by actor identity",
    updatedNotif?.metadata?.worker_acknowledged_by
  );

  // 3.4 Test 2: Idempotency & Duplicate Prevention
  const ack2Success = await acknowledgeTaskAssignment({
    taskId: testTask.id,
    actorId: adminUserId,
    notificationId: testNotif.id,
    client,
  });
  assert(ack2Success === true, "Repeated acknowledgment call returns true (idempotent)");

  const { data: duplicateActivityCheck } = await (client as any)
    .from("project_activity")
    .select("id")
    .eq("task_id", testTask.id)
    .eq("action", "task_acknowledged");

  assert(
    duplicateActivityCheck?.length === 1,
    "Duplicate acknowledgment PREVENTED: Still exactly 1 row in project_activity",
    duplicateActivityCheck?.length
  );

  // 3.5 Test 3: Unauthorized Actor Acknowledgment Prevention
  const fakeUnauthorizedId = "00000000-0000-0000-0000-000000000999";
  const unauthSuccess = await acknowledgeTaskAssignment({
    taskId: testTask.id,
    actorId: fakeUnauthorizedId,
    client,
  });
  assert(
    unauthSuccess === false,
    "Unauthorized actor acknowledgment correctly REJECTED (returns false)"
  );

  // ============================================================
  // STAGE 4: Controlled Live Resend Delivery & Assigner Name
  // ============================================================
  console.log("\n--- STAGE 4: Controlled Live Resend Email Dispatch ---");

  const resend = getResendClient();
  assert(Boolean(resend), "Resend client initialized successfully");

  // Create real notification targeting adminEmail with live dispatch
  const { data: liveNotif } = await (client as any)
    .from("notifications")
    .insert({
      user_id: adminUserId,
      event_type: "TASK_ASSIGNED",
      title: "Task Assigned: 4K Color Master Deliverable",
      message: "Hermès Paris commercial ready for color grading.",
      category: "task",
      priority: "high",
      entity_type: "task",
      entity_id: testTask.id,
      link_url: `/admin/my-work?taskId=${testTask.id}`,
      metadata: {
        recipient_email: adminEmail,
        taskId: testTask.id,
        deadline: "2026-11-20T16:00:00Z",
      },
    })
    .select("id, metadata")
    .single();

  assert(Boolean(liveNotif?.id), "Created live dispatch test notification", liveNotif?.id);

  // Dispatch live email
  const dispatchRes = await dispatchEmailNotification(liveNotif.id, {
    client,
    overrideRecipientEmail: adminEmail,
    overrideRecipientName: "Boubakar Hamed",
  });

  assert(dispatchRes.success === true, "dispatchEmailNotification returned success=true", dispatchRes);
  assert(dispatchRes.sentCount === 1, "sentCount is exactly 1", dispatchRes.sentCount);
  assert(dispatchRes.deliveryStatus === "sent", "deliveryStatus transitioned to 'sent'", dispatchRes.deliveryStatus);

  const resendMessageId = dispatchRes.recipientDetails[0]?.resendMessageId;
  assert(Boolean(resendMessageId), "Resend API returned live message ID", resendMessageId);

  // Verify delivery tracking stored in database
  const { data: liveNotifAfterSend } = await (client as any)
    .from("notifications")
    .select("metadata")
    .eq("id", liveNotif.id)
    .single();

  const tracking = liveNotifAfterSend?.metadata?.email_delivery_tracking;
  assert(tracking?.deliveryStatus === "sent", "Database metadata records deliveryStatus 'sent'", tracking?.deliveryStatus);
  assert(tracking?.sentCount === 1, "Database metadata records sentCount = 1", tracking?.sentCount);
  assert(
    tracking?.recipients?.[adminEmail.toLowerCase()]?.resendMessageId === resendMessageId,
    "Database metadata maps recipient to Resend message ID"
  );

  // Verify email delivery did NOT count as task acknowledgment
  assert(
    liveNotifAfterSend?.metadata?.worker_acknowledged_at === undefined,
    "CRITICAL RULE VERIFIED: Email delivery did NOT count as worker acknowledgment"
  );

  // 4.2 End-to-End Live Dispatch for All Remaining 9 Canonical Event Categories
  console.log("\n--- STAGE 4.B: End-to-End Live Dispatch for All 10 Event Categories ---");
  const liveNotificationIds: string[] = [liveNotif.id];

  const operationalEvents: { eventType: NotificationEventType; title: string; message: string; metadata: any }[] = [
    {
      eventType: "TASK_DUE_SOON",
      title: "Deadline Approaching: Vogue Editorial Reel",
      message: "Delivery is due in less than 24 hours.",
      metadata: { taskTitle: "Vogue Editorial Reel", clientName: "Vogue France", deadline: "2026-11-17T14:00:00Z" },
    },
    {
      eventType: "TASK_OVERDUE",
      title: "Timeline Overdue: Cartier Campaign Grade",
      message: "Task has exceeded its scheduled completion window.",
      metadata: { taskTitle: "Cartier Campaign Grade", clientName: "Cartier", deadline: "2026-11-13T12:00:00Z" },
    },
    {
      eventType: "TASK_REVISION_REQUESTED",
      title: "Revisions Requested: Dior Beauty Retouching",
      message: "Please adjust highlight saturation on frame 120-180.",
      metadata: { taskTitle: "Dior Beauty Retouching", reviewerName: "Senior Art Director", feedback: "Reduce magenta spill on skin tones." },
    },
    {
      eventType: "USER_MENTIONED",
      title: "Mentioned: Balenciaga Motion Graphics",
      message: "@Boubakar can you verify the aspect ratio for IG stories?",
      metadata: { authorName: "Lead Motion Designer", commentText: "Assets ready in 9:16 and 4:5 vertical cuts." },
    },
    {
      eventType: "CLIENT_APPROVAL_REQUIRED",
      title: "Client Action Required: YSL Commercial Sign-off",
      message: "Client brand team needs to approve rough cut.",
      metadata: { clientName: "YSL Beaute", actionNeeded: "Final rough cut approval", deadline: "2026-11-19T17:00:00Z" },
    },
    {
      eventType: "TASK_REVIEW_REQUESTED",
      title: "QA Review Required: Rolex Sound Mix",
      message: "Specialist submitted 5.1 surround master for sign-off.",
      metadata: { taskTitle: "Rolex Sound Mix", workerName: "Sound Engineer", submittedAt: "2026-11-14T15:00:00Z" },
    },
    {
      eventType: "SECURITY_AUDIT",
      title: "Security Notice: Password Changed Successfully",
      message: "Your workstation access credentials were updated.",
      metadata: { timestamp: "2026-11-14T16:00:00Z", guidance: "If you did not make this change, notify Super Admin immediately." },
    },
    {
      eventType: "INVOICE_OVERDUE",
      title: "Billing Alert: Overdue Invoice INV-2026-089",
      message: "Invoice for retained production is past due.",
      metadata: { clientName: "Bvlgari Middle East", invoiceNumber: "INV-2026-089", amount: "28,000", dueDate: "2026-11-11" },
    },
    {
      eventType: "PRODUCTION_TOMORROW",
      title: "Call Sheet: Tomorrow 08:00 AM Studio Shoot",
      message: "Commercial production shoot on Studio SADA Stage A.",
      metadata: { shootTitle: "Hermès Leather Film", clientName: "Hermès Paris", date: "2026-11-15", time: "08:00 AM", location: "Stage A, Tunis" },
    },
  ];

  for (const ev of operationalEvents) {
    // Small throttle between API calls to respect Resend sending rates
    await new Promise((resolve) => setTimeout(resolve, 600));

    const { data: notifRecord } = await (client as any)
      .from("notifications")
      .insert({
        user_id: adminUserId,
        event_type: ev.eventType,
        title: ev.title,
        message: ev.message,
        category: "task",
        priority: "high",
        entity_type: "task",
        entity_id: testTask.id,
        link_url: `/admin/my-work?taskId=${testTask.id}`,
        metadata: {
          recipient_email: adminEmail,
          ...ev.metadata,
        },
      })
      .select("id, metadata")
      .single();

    if (notifRecord?.id) {
      liveNotificationIds.push(notifRecord.id);
      const res = await dispatchEmailNotification(notifRecord.id, {
        client,
        overrideRecipientEmail: adminEmail,
        overrideRecipientName: "Boubakar Hamed (Live Test)",
      });

      assert(
        res.success === true && Boolean(res.recipientDetails[0]?.resendMessageId),
        `Live Resend delivery verified for ${ev.eventType} (msgId: ${res.recipientDetails[0]?.resendMessageId})`
      );
    }
  }

  // ============================================================
  // STAGE 5: Webhook Signature Verification & Delivery Transitions
  // ============================================================
  console.log("\n--- STAGE 5: Webhook Signature & Status Transitions ---");

  const testSecret = "whsec_test_secret_key_sada_2026";
  const testPayload = {
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: {
      id: "evt_test_delivered_001",
      email_id: resendMessageId,
    },
  };

  // 5.1 Test signature verification function
  const validSig = verifyWebhookSignature(testPayload, testSecret, testSecret);
  assert(validSig === true, "verifyWebhookSignature accepts valid signature / matching token");

  const invalidSig = verifyWebhookSignature(testPayload, "invalid_forged_sig", testSecret);
  assert(invalidSig === false, "verifyWebhookSignature strictly rejects forged signature");

  // 5.2 Test webhook handler with signature enforcement
  const unauthWebhook = await handleResendWebhook(testPayload, {
    client,
    webhookSecret: testSecret,
    signatureHeader: "bad_signature",
  });
  assert(unauthWebhook.success === false, "Webhook handler rejects invalid signature with error", unauthWebhook.reason);

  // 5.3 Test valid delivery transition
  const validWebhook = await handleResendWebhook(testPayload, {
    client,
    webhookSecret: testSecret,
    signatureHeader: testSecret,
  });
  assert(validWebhook.success === true && validWebhook.processed === true, "Webhook transitioned status to 'delivered'");

  // Verify recipient attempt status in database
  const { data: notifAfterWebhook } = await (client as any)
    .from("notifications")
    .select("metadata")
    .eq("id", liveNotif.id)
    .single();

  const recipientRecord = notifAfterWebhook?.metadata?.email_delivery_tracking?.recipients?.[adminEmail.toLowerCase()];
  assert(recipientRecord?.status === "delivered", "Recipient status transitioned to 'delivered' via verified webhook");

  // 5.4 Test duplicate webhook idempotency
  const dupWebhook = await handleResendWebhook(testPayload, {
    client,
    webhookSecret: testSecret,
    signatureHeader: testSecret,
  });
  assert(
    dupWebhook.success === true && dupWebhook.processed === false,
    "Duplicate webhook safely skipped due to idempotency guard"
  );

  // ============================================================
  // STAGE 6: Cleanup Test Data
  // ============================================================
  console.log("\n--- STAGE 6: Test Record Cleanup ---");
  await (client as any).from("notifications").delete().in("id", [testNotif.id, ...liveNotificationIds]);
  await (client as any).from("project_activity").delete().eq("task_id", testTask.id);
  await (client as any).from("project_tasks").delete().eq("id", testTask.id);
  console.log("  🧹 Successfully purged temporary test task, notifications, and activity records.");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n============================================================");
  console.log(`FINAL ACCEPTANCE AUDIT: ${totalChecks} CHECKS | ${passedChecks} PASSED | ${failedChecks} FAILED`);
  console.log("============================================================\n");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runFinalAcceptanceSuite().catch((err) => {
  console.error("❌ Fatal unhandled exception in test suite:", err);
  process.exit(1);
});
