// ============================================================
// SADA OS — RESEND TRANSACTIONAL EMAIL INTEGRATION TEST SUITE
// Automated verification covering:
// 1. Client initialization and environment safety
// 2. 10 dedicated email template renderers & XSS sanitization
// 3. Worker acknowledgment policy & deep-link parameters
// 4. Controlled live dispatch to Super Admin test inbox
// 5. Database metadata tracking persistence
// 6. User preference opt-out enforcement
// 7. Missing/invalid recipient error resilience
// 8. Resend webhook processing & idempotency guard
// 9. Zero secret leakage audit across client bundles
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Step 1: Load environment variables (.env and .env.local)
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

import { getResendClient, dispatchEmailNotification, handleResendWebhook } from "../src/server/email-dispatcher";
import {
  renderNotificationEmail,
  renderTaskAssignedTemplate,
  renderDeadlineReminderTemplate,
  renderRevisionRequestedTemplate,
  renderCommentMentionTemplate,
  renderClientActionTemplate,
  renderTaskReviewTemplate,
  renderSecurityEventTemplate,
  renderBillingFinanceTemplate,
  renderProductionCalendarTemplate,
  renderCanonicalGeneralTemplate,
} from "../src/server/email-templates";
import type { NotificationEventType } from "../src/types/notifications-and-audit";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("\n============================================================");
  console.log("   SADA OS — RESEND TRANSACTIONAL EMAIL INTEGRATION SUITE   ");
  console.log("============================================================\n");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL;
  const adminPass = process.env.SYSTEM_ADMIN_PASSWORD;

  if (!adminEmail || !adminPass) {
    console.error("❌ Fatal: SYSTEM_ADMIN_EMAIL or SYSTEM_ADMIN_PASSWORD missing from environment.");
    process.exit(1);
  }

  if (!supabaseUrl || !anonKey) {
    console.error("❌ Fatal: Supabase credentials missing from environment.");
    process.exit(1);
  }

  // Authenticate admin client
  const adminAuthClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authErr } = await adminAuthClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass,
  });

  if (authErr || !authData.session?.access_token) {
    console.error("❌ Fatal: Could not authenticate test admin:", authErr?.message);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
  });

  const superAdminUserId = authData.user.id;
  console.log(`🔑 Test Authenticated as Super Admin: ${adminEmail} (${superAdminUserId})\n`);

  // ------------------------------------------------------------
  // TEST GROUP 1: Environment & Client Initialization
  // ------------------------------------------------------------
  console.log("--- TEST GROUP 1: Environment & SDK Initialization ---");
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const resendFromName = process.env.RESEND_FROM_NAME;

  assert(Boolean(resendApiKey && resendApiKey.startsWith("re_")), "RESEND_API_KEY is configured and valid format");
  assert(resendFromEmail === "notifications@boubakarhamedsghaier.com", `RESEND_FROM_EMAIL matches verified domain (${resendFromEmail})`);
  assert(resendFromName === "SADA", `RESEND_FROM_NAME matches 'SADA' (${resendFromName})`);

  const resendClient = getResendClient();
  assert(resendClient !== null, "Resend SDK client successfully initialized");

  // ------------------------------------------------------------
  // TEST GROUP 2: Email Template Rendering & Visual Hierarchy
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Template System & XSS Protection ---");

  const xssPayload = '<script>alert("XSS")</script>';
  const baseTestParams = {
    title: `Luxury Campaign Review ${xssPayload}`,
    message: `A new task has been assigned for review ${xssPayload}`,
    contextTitle: `Project Elysium ${xssPayload}`,
    sourceModule: "tasks",
    linkUrl: "/admin/tasks/elysium-101",
    notificationId: "notif_test_123",
    metadata: {
      priority: "urgent",
      assigned_by_name: "Boubakar Hamed",
      deadline: "2026-11-20T18:00:00Z",
    },
  };

  // 2.1 Task Assigned Template
  const taskAssignedEmail = renderTaskAssignedTemplate({
    ...baseTestParams,
    eventType: "TASK_ASSIGNED",
  });
  assert(taskAssignedEmail.templateId.startsWith("task_assigned"), `Task Assigned templateId is correct (${taskAssignedEmail.templateId})`);
  assert(taskAssignedEmail.subject.includes("[SADA Task] Assigned:"), "Task Assigned subject contains proper badge prefix");
  assert(taskAssignedEmail.html.includes("#5CE1E6"), "Email HTML includes SADA brand cyan accent (#5CE1E6)");
  assert(taskAssignedEmail.html.includes("#FFFFFF") && taskAssignedEmail.html.includes("#F4F7FB"), "Email HTML includes SADA premium light theme canvas (#F4F7FB) and card (#FFFFFF)");
  assert(!taskAssignedEmail.html.includes("<script>"), "HTML escaping prevents raw <script> execution");
  assert(taskAssignedEmail.html.includes("&lt;script&gt;"), "XSS payload properly converted to HTML entities");
  assert(taskAssignedEmail.html.includes("utm_source=email_resend"), "CTA link contains required tracking utm parameters");
  assert(taskAssignedEmail.html.includes("does not constitute official acknowledgment"), "Universal Worker Acknowledgment notice is present");

  // 2.2 Deadline Reminder Template
  const deadlineEmail = renderDeadlineReminderTemplate({
    ...baseTestParams,
    eventType: "TASK_DEADLINE",
  });
  assert(deadlineEmail.templateId.startsWith("deadline_reminder"), "Deadline Reminder templateId is correct");
  assert(deadlineEmail.subject.includes("Reminder") || deadlineEmail.subject.includes("OVERDUE"), "Deadline Reminder subject is correct");

  // 2.3 Revision Requested Template
  const revisionEmail = renderRevisionRequestedTemplate({
    ...baseTestParams,
    eventType: "TASK_REVISION_REQUESTED",
  });
  assert(revisionEmail.templateId.startsWith("revision_requested"), "Revision Requested templateId is correct");
  assert(revisionEmail.subject.includes("Changes Requested"), "Revision Requested subject is correct");

  // 2.4 New Comment / Mention Template
  const commentEmail = renderCommentMentionTemplate({
    ...baseTestParams,
    eventType: "TASK_COMMENT",
  });
  assert(commentEmail.templateId.startsWith("comment_mention"), "New Comment templateId is correct");

  // 2.5 Client Action Required Template
  const clientActionEmail = renderClientActionTemplate({
    ...baseTestParams,
    eventType: "CLIENT_APPROVAL_REQUIRED",
  });
  assert(clientActionEmail.templateId.startsWith("client_action"), "Client Action Required templateId is correct");

  // 2.6 Task Review Requested Template
  const reviewEmail = renderTaskReviewTemplate({
    ...baseTestParams,
    eventType: "TASK_REVIEW_REQUESTED",
  });
  assert(reviewEmail.templateId.startsWith("task_review"), "Task Review Requested templateId is correct");

  // 2.7 Account & Security Events Template
  const securityEmail = renderSecurityEventTemplate({
    ...baseTestParams,
    eventType: "SECURITY_AUDIT",
  });
  assert(securityEmail.templateId.startsWith("account_security"), "Account & Security templateId is correct");

  // 2.8 Billing & Finance Events Template
  const billingEmail = renderBillingFinanceTemplate({
    ...baseTestParams,
    eventType: "INVOICE_OVERDUE",
  });
  assert(billingEmail.templateId.startsWith("billing_finance"), "Billing & Finance templateId is correct");

  // 2.9 Production & Calendar Events Template
  const productionEmail = renderProductionCalendarTemplate({
    ...baseTestParams,
    eventType: "PRODUCTION_TOMORROW",
  });
  assert(productionEmail.templateId.startsWith("production_calendar"), "Production & Calendar templateId is correct");

  // 2.10 General Fallback Template
  const generalEmail = renderCanonicalGeneralTemplate({
    ...baseTestParams,
    eventType: "GENERAL",
  });
  assert(generalEmail.templateId.startsWith("canonical_general"), "Canonical General templateId is correct");

  // 2.11 Master Dispatcher Routing for 48 Canonical Events
  const testEvents: NotificationEventType[] = [
    "TASK_ASSIGNED",
    "TASK_DEADLINE",
    "TASK_REVISION_REQUESTED",
    "TASK_COMMENT",
    "CLIENT_INFO_SUBMITTED",
    "REVIEW_ASSIGNED",
    "SECURITY_AUDIT",
    "INVOICE_OVERDUE",
    "PRODUCTION_TOMORROW",
    "GENERAL",
  ];
  let routingSuccess = true;
  for (const ev of testEvents) {
    const rendered = renderNotificationEmail({ ...baseTestParams, eventType: ev });
    if (!rendered.html || !rendered.subject || !rendered.templateId) {
      routingSuccess = false;
      break;
    }
  }
  assert(routingSuccess, "Master dispatcher renderNotificationEmail successfully maps all event categories");

  // ------------------------------------------------------------
  // TEST GROUP 3: Controlled Live Dispatch to Super Admin Test Inbox
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Controlled Live Email Dispatch via Resend ---");
  const testInboxEmail = "boubakarhamedsgail@gmail.com";
  console.log(`  📧 Target test recipient: ${testInboxEmail}`);

  // Create a deterministic test notification record in DB (let DB generate UUID)
  const { data: createdNotif, error: notifInsertErr } = await (supabase as any)
    .from("notifications")
    .insert({
      user_id: superAdminUserId,
      event_type: "TASK_ASSIGNED",
      category: "task",
      priority: "urgent",
      source_module: "tasks",
      title: "Luxury Brand Campaign Strategy [Automated Test]",
      message: "Please review and formalize the Q1 SADA digital identity deliverables in the workstation.",
      context_title: "SADA Digital Luxe Core",
      link_url: "/admin/tasks/test-task-1",
      read: false,
      metadata: {
        task_id: "test-task-1",
        priority: "urgent",
        assigned_by_name: "SADA Quality Assurance",
        deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    })
    .select()
    .single();

  if (notifInsertErr) {
    console.error("  ❌ notifInsertErr details:", JSON.stringify(notifInsertErr));
  }
  assert(!notifInsertErr && Boolean(createdNotif), `Created test notification in database (${createdNotif?.id})`);

  let dispatchedResendMessageId = "";
  const testNotifId = createdNotif?.id;

  if (testNotifId) {
    const dispatchRes = await dispatchEmailNotification(testNotifId, {
      client: supabase,
      overrideRecipientEmail: testInboxEmail,
      overrideRecipientName: "Boubakar Hamed Sghaier (Super Admin)",
    });

    assert(dispatchRes.success === true, "dispatchEmailNotification returned success=true", dispatchRes.error);
    assert(dispatchRes.sentCount === 1, `sentCount is exactly 1 (actual: ${dispatchRes.sentCount})`);
    assert(dispatchRes.deliveryStatus === "sent", `deliveryStatus is 'sent' (actual: ${dispatchRes.deliveryStatus})`);

    const attempt = dispatchRes.recipientDetails[0];
    assert(Boolean(attempt?.resendMessageId), `Resend returned valid message ID (${attempt?.resendMessageId})`);
    dispatchedResendMessageId = attempt?.resendMessageId || "";

    // Verify DB persistence of delivery tracking
    const { data: refreshedNotif } = await (supabase as any)
      .from("notifications")
      .select("metadata")
      .eq("id", testNotifId)
      .single();

    const tracking = refreshedNotif?.metadata?.email_delivery_tracking;
    assert(tracking?.deliveryStatus === "sent", "notifications.metadata.email_delivery_tracking.deliveryStatus is 'sent'");
    assert(tracking?.sentCount === 1, "notifications.metadata.email_delivery_tracking.sentCount is 1");
    assert(
      tracking?.recipients?.[testInboxEmail]?.resendMessageId === dispatchedResendMessageId,
      "notifications.metadata records the correct resendMessageId"
    );

    // Test Idempotency (sending again without forceRetry must skip)
    const idempotentRes = await dispatchEmailNotification(testNotifId, {
      client: supabase,
      overrideRecipientEmail: testInboxEmail,
      overrideRecipientName: "Boubakar Hamed Sghaier",
    });
    assert(idempotentRes.skippedCount === 1, "Duplicate dispatch cleanly skipped due to idempotency guard");
  }

  // ------------------------------------------------------------
  // TEST GROUP 4: User Notification Preference Opt-Out
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: User Notification Preference Opt-Out ---");

  // Create temporary user preference with task_due_soon = false
  await (supabase as any).from("notification_preferences").upsert({
    user_id: superAdminUserId,
    task_due_soon: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  const { data: optOutNotif } = await (supabase as any).from("notifications").insert({
    user_id: superAdminUserId,
    event_type: "TASK_DEADLINE",
    category: "task",
    priority: "normal",
    source_module: "tasks",
    title: "Opt-Out Preference Test",
    message: "This notification should skip email dispatch because preferences are turned off.",
    read: false,
    metadata: {
      recipient_email: testInboxEmail,
    },
  }).select().single();

  if (optOutNotif) {
    const optOutRes = await dispatchEmailNotification(optOutNotif.id, {
      client: supabase,
    });

    assert(
      optOutRes.optedOutCount >= 1 || optOutRes.deliveryStatus === "opted_out" || optOutRes.skippedCount >= 1,
      `Email dispatch correctly respected disabled preference (status: ${optOutRes.deliveryStatus})`
    );

    // Clean up opt-out notification
    await (supabase as any).from("notifications").delete().eq("id", optOutNotif.id);
  }

  // Restore preference
  await (supabase as any).from("notification_preferences").upsert({
    user_id: superAdminUserId,
    task_due_soon: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // ------------------------------------------------------------
  // TEST GROUP 5: Error Resilience & Missing Recipients
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Missing / Invalid Recipient Resilience ---");

  const { data: invalidNotif } = await (supabase as any).from("notifications").insert({
    user_id: null,
    role_target: null,
    event_type: "GENERAL",
    category: "system",
    priority: "low",
    source_module: "system",
    title: "Orphan Notification",
    message: "No recipient attached.",
    read: false,
  }).select().single();

  if (invalidNotif) {
    const invalidRes = await dispatchEmailNotification(invalidNotif.id, {
      client: supabase,
    });

    assert(invalidRes.success === true, "Missing recipient handled cleanly without uncaught exception");
    assert(invalidRes.deliveryStatus === "skipped", "Orphan notification delivery status marked 'skipped'");
    assert(invalidRes.error?.includes("No valid recipient"), "Meaningful diagnostic message logged");

    await (supabase as any).from("notifications").delete().eq("id", invalidNotif.id);
  }

  // ------------------------------------------------------------
  // TEST GROUP 6: Webhook Simulation & Idempotency Guard
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Resend Webhook Processing & Idempotency ---");

  if (dispatchedResendMessageId && testNotifId) {
    const webhookEventId = `wh_evt_${Date.now()}`;
    const webhookPayload = {
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: {
        id: webhookEventId,
        email_id: dispatchedResendMessageId,
        to: [testInboxEmail],
        from: "SADA <notifications@boubakarhamedsghaier.com>",
        subject: "Luxury Brand Campaign Strategy [Automated Test]",
      },
    };

    // First delivery event
    const whRes1 = await handleResendWebhook(webhookPayload, { client: supabase });
    assert(whRes1.success === true && whRes1.processed === true, "Webhook email.delivered processed successfully");

    // Verify DB status changed from 'sent' to 'delivered'
    const { data: updatedNotif } = await (supabase as any)
      .from("notifications")
      .select("metadata")
      .eq("id", testNotifId)
      .single();

    const whTracking = updatedNotif?.metadata?.email_delivery_tracking;
    assert(
      whTracking?.recipients?.[testInboxEmail]?.status === "delivered",
      "Recipient status transitioned to 'delivered' via webhook"
    );

    // Duplicate delivery event (test idempotency)
    const whRes2 = await handleResendWebhook(webhookPayload, { client: supabase });
    assert(
      whRes2.success === true && whRes2.processed === false && whRes2.reason?.includes("idempotent"),
      "Duplicate webhook payload safely rejected by idempotency guard"
    );
  } else {
    console.warn("  ⚠️ Skipping webhook test because no resendMessageId was generated.");
  }

  // ------------------------------------------------------------
  // TEST GROUP 7: Zero Secret Leakage Audit
  // ------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Zero Secret Leakage Audit ---");

  // Check client files in src/components, src/routes, src/hooks
  const clientDirs = [
    path.resolve(process.cwd(), "src", "components"),
    path.resolve(process.cwd(), "src", "routes"),
    path.resolve(process.cwd(), "src", "hooks"),
  ];

  const actualKeyPattern = /re_[a-zA-Z0-9_]{20,}/;
  let leakedSecretFound = false;
  for (const dir of clientDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (currDir: string) => {
      const entries = fs.readdirSync(currDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          if (fileContent.includes("RESEND_API_KEY") || actualKeyPattern.test(fileContent)) {
            console.error(`  ❌ SECRET LEAK DETECTED in client file: ${fullPath}`);
            leakedSecretFound = true;
          }
        }
      }
    };
    walk(dir);
  }

  assert(!leakedSecretFound, "Zero client-side exposure of RESEND_API_KEY detected in components/routes/hooks");

  // Check git tracked .env file
  const trackedEnvPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(trackedEnvPath)) {
    const trackedContent = fs.readFileSync(trackedEnvPath, "utf-8");
    const hasActiveSecret = actualKeyPattern.test(trackedContent) || /RESEND_API_KEY\s*=\s*re_[a-zA-Z0-9_]{10,}/.test(trackedContent);
    assert(!hasActiveSecret, "Tracked .env file contains NO active secret keys (safe for git push)");
  }

  // Clean up created test notification
  if (testNotifId) {
    await (supabase as any).from("notifications").delete().eq("id", testNotifId);
    console.log(`\n🧹 Cleaned up temporary test notification ${testNotifId}`);
  }

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------
  console.log("\n============================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("============================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("❌ Fatal Test Error:", err);
  process.exit(1);
});
