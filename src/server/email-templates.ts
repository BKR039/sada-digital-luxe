// ============================================================
// SADA OS — TRANSACTIONAL EMAIL TEMPLATE SYSTEM
// Luxury Branded HTML & Plaintext Email Templates for Canonical Events
// Mobile-First, Bulletproof Table Layout, Security-Hardened
// ============================================================

import type { NotificationEventType, NotificationEmailTemplateId } from "@/types/notifications-and-audit";

export interface RenderNotificationEmailParams {
  eventType: NotificationEventType;
  title: string;
  message: string;
  recipientName?: string;
  recipientEmail?: string;
  contextTitle?: string;
  sourceModule?: string;
  linkUrl?: string;
  notificationId?: string;
  metadata?: Record<string, any>;
  baseUrl?: string;
}

export interface RenderedEmail {
  templateId: NotificationEmailTemplateId;
  templateVersion: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * HTML Escaper to prevent XSS / injection attacks in email clients.
 */
export function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a clean deep-link target with notification and acknowledgment tracking params.
 */
function resolveActionUrl(linkUrl?: string, notificationId?: string, baseUrl = "https://sada.agency"): string {
  const origin = (process.env.APP_BASE_URL || process.env.VITE_APP_URL || baseUrl).replace(/\/$/, "");
  let path = linkUrl || "/admin";
  if (!path.startsWith("/")) path = "/" + path;

  // Append notif tracking id for automated in-app focus and acknowledgment
  const separator = path.includes("?") ? "&" : "?";
  const trackingParam = notificationId ? `${separator}notif=${encodeURIComponent(notificationId)}&utm_source=email_resend` : "";
  return `${origin}${path}${trackingParam}`;
}

/**
 * Core SADA Luxury Email HTML Shell.
 * Responsive table-based layout compatible with Gmail, Apple Mail, Outlook (Windows/Mac/Web), iOS, Android.
 */
function wrapInSadaLayout(options: {
  categoryLabel: string;
  categoryBadgeColor: string;
  heading: string;
  contentHtml: string;
  actionUrl: string;
  actionLabel: string;
  showAckNotice?: boolean;
}): string {
  const { categoryLabel, categoryBadgeColor, heading, contentHtml, actionUrl, actionLabel, showAckNotice = true } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(heading)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #080D1A;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #E2E8F0;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    .email-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #0D1527;
      border: 1px solid #1E293B;
      border-radius: 16px;
      overflow: hidden;
    }
    .cta-button:hover {
      background-color: #4BD4D9 !important;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .content-padding {
        padding: 24px 20px !important;
      }
      .header-padding {
        padding: 24px 20px 16px 20px !important;
      }
      .footer-padding {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #080D1A; color: #E2E8F0;">
  <center style="width: 100%; table-layout: fixed;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080D1A;">
      <tr>
        <td align="center" style="padding: 16px 8px;">
          <!-- Top Neon Cyan Accent Line -->
          <div style="max-width: 600px; height: 3px; background: linear-gradient(90deg, #5CE1E6 0%, #3B82F6 100%); border-radius: 3px 3px 0 0;"></div>
          
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; background-color: #0D1527; border: 1px solid #1E293B; border-radius: 0 0 16px 16px;">
            
            <!-- HEADER -->
            <tr>
              <td class="header-padding" style="padding: 32px 32px 20px 32px; border-bottom: 1px solid #162238;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="left" valign="middle">
                      <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.12em; color: #FFFFFF; text-transform: uppercase;">
                        SADA <span style="color: #5CE1E6; font-size: 20px;">·</span> <span style="font-size: 11px; font-weight: 500; letter-spacing: 0.2em; color: #94A3B8;">OPERATING SYSTEM</span>
                      </div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 9999px; background-color: rgba(92, 225, 230, 0.12); color: ${categoryBadgeColor}; border: 1px solid ${categoryBadgeColor}40;">
                        ${escapeHtml(categoryLabel)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- MAIN BODY -->
            <tr>
              <td class="content-padding" style="padding: 32px;">
                <!-- Main Event Heading -->
                <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.35; color: #FFFFFF; letter-spacing: -0.01em;">
                  ${escapeHtml(heading)}
                </h1>

                <!-- Event Specific Content -->
                <div style="font-size: 14px; line-height: 1.6; color: #CBD5E1;">
                  ${contentHtml}
                </div>

                <!-- Action Button CTA -->
                <div style="margin-top: 32px; text-align: center;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(actionUrl)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="16%" stroke="f" fillcolor="#5CE1E6">
                    <w:anchorlock/>
                    <center style="color:#080D1A;font-family:sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(actionLabel)}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${escapeHtml(actionUrl)}" class="cta-button" style="display: inline-block; padding: 14px 32px; background: #5CE1E6; color: #080D1A; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(92, 225, 230, 0.25);">
                    ${escapeHtml(actionLabel)} &rarr;
                  </a>
                  <!--<![endif]-->
                </div>

                ${showAckNotice ? `
                <!-- Authenticated Acknowledgment Notice -->
                <div style="margin-top: 24px; padding: 12px 16px; background-color: rgba(15, 23, 42, 0.6); border: 1px solid #1E293B; border-radius: 8px; font-size: 12px; line-height: 1.5; color: #94A3B8;">
                  <strong style="color: #5CE1E6;">Action Required:</strong> Under SADA OS Operating Rules, viewing this email does not constitute official acknowledgment. Please follow the link to record your authenticated acknowledgment.
                </div>
                ` : ""}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td class="footer-padding" style="padding: 24px 32px; background-color: #090E1D; border-top: 1px solid #162238; text-align: center; font-size: 12px; line-height: 1.6; color: #64748B;">
                <p style="margin: 0 0 8px 0; color: #94A3B8;">
                  This is an automated operational notification from <strong>SADA Operating System</strong>.
                </p>
                <p style="margin: 0 0 12px 0; font-size: 11px; color: #64748B;">
                  Confidential & Proprietary · SADA Digital Luxe · Tunis, Tunisia
                </p>
                <p style="margin: 0; font-size: 11px;">
                  <a href="${escapeHtml(actionUrl)}" style="color: #5CE1E6; text-decoration: underline;">Open SADA OS Dashboard</a> · 
                  <a href="${escapeHtml(actionUrl.split("?")[0] + "/settings")}" style="color: #94A3B8; text-decoration: underline;">Notification Preferences</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

/**
 * Builds a structured key-value metadata panel.
 */
function renderDataGrid(items: { label: string; value: string; highlight?: boolean; badgeColor?: string }[]): string {
  const rows = items
    .filter(item => Boolean(item.value))
    .map(item => `
      <tr>
        <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; width: 35%; border-bottom: 1px solid #1A2640;">
          ${escapeHtml(item.label)}
        </td>
        <td style="padding: 8px 12px; font-size: 13px; font-weight: 500; color: ${item.highlight ? "#5CE1E6" : "#F8FAFC"}; border-bottom: 1px solid #1A2640;">
          ${item.badgeColor ? `<span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: ${item.badgeColor}20; color: ${item.badgeColor}; border: 1px solid ${item.badgeColor}40;">${escapeHtml(item.value)}</span>` : escapeHtml(item.value)}
        </td>
      </tr>
    `)
    .join("");

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0 20px 0; background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; overflow: hidden;">
      ${rows}
    </table>
  `;
}

/**
 * Builds a callout quote / feedback box.
 */
function renderCalloutBox(title: string, body: string, borderColor = "#5CE1E6"): string {
  return `
    <div style="margin: 16px 0; padding: 14px 18px; background-color: rgba(15, 23, 42, 0.7); border-left: 3px solid ${borderColor}; border-radius: 0 8px 8px 0;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${borderColor}; margin-bottom: 4px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #E2E8F0;">
        ${escapeHtml(body)}
      </div>
    </div>
  `;
}

// ============================================================
// TEMPLATE HANDLERS
// ============================================================

/**
 * 1. Task Assigned Template
 */
export function renderTaskAssignedTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title.replace(/^Task Assigned:\s*/i, "");
  const clientName = meta.clientName || params.contextTitle || "SADA Internal";
  const priority = (meta.priority || "normal").toUpperCase();
  const deadline = meta.deadline || "Not specified";
  const assignedBy = meta.assignedByName || "Project Lead";
  const description = meta.description || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Client / Project", value: clientName },
    { label: "Priority", value: priority, badgeColor: priority === "URGENT" || priority === "HIGH" ? "#EF4444" : "#5CE1E6" },
    { label: "Deadline", value: deadline, highlight: true },
    { label: "Assigned By", value: assignedBy },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">A new operational deliverable has been assigned to your workspace in SADA OS:</p>
    ${gridHtml}
    ${description ? renderCalloutBox("Task Brief / Scope", description, "#5CE1E6") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Task Assigned",
    categoryBadgeColor: "#5CE1E6",
    heading: `Task Assigned: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Open & Acknowledge Task",
    showAckNotice: true,
  });

  const text = `SADA OS — Task Assigned\n\nTask: ${taskTitle}\nClient: ${clientName}\nPriority: ${priority}\nDeadline: ${deadline}\nAssigned By: ${assignedBy}\n\nBrief:\n${description}\n\nOpen & Acknowledge: ${actionUrl}\n\n(Viewing this email does not constitute official acknowledgment. Please authenticate in SADA OS.)`;

  return {
    templateId: "task_assigned_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Task] Assigned: ${taskTitle} (${clientName})`,
    html,
    text,
  };
}

/**
 * 2. Deadline Reminder & Overdue Template
 */
export function renderDeadlineReminderTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const isOverdue = params.eventType === "TASK_OVERDUE" || params.eventType === "DELIVERABLE_BEHIND";
  const taskTitle = meta.taskTitle || params.title;
  const clientName = meta.clientName || params.contextTitle || "Deliverable";
  const deadline = meta.deadline || "Immediate";
  const timeInfo = meta.remainingTime || meta.overdueDuration || (isOverdue ? "Deadline Passed" : "Due Soon (Action Required)");
  const currentStatus = (meta.status || "In Progress").toUpperCase();
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const badgeColor = isOverdue ? "#EF4444" : "#F59E0B";

  const gridHtml = renderDataGrid([
    { label: "Deliverable", value: taskTitle },
    { label: "Client Account", value: clientName },
    { label: "Target Deadline", value: deadline, highlight: true },
    { label: "Timeline Status", value: timeInfo, badgeColor },
    { label: "Current State", value: currentStatus },
  ]);

  const alertNote = isOverdue
    ? "This task has exceeded its scheduled completion window. Please review immediate next steps, submit deliverables, or report blockers."
    : "This task is approaching its deadline. Ensure assets and reviews are completed on time to maintain agency SLAs.";

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">${escapeHtml(params.message)}</p>
    ${gridHtml}
    ${renderCalloutBox(isOverdue ? "CRITICAL TIMELINE ALERT" : "DEADLINE NOTICE", alertNote, badgeColor)}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: isOverdue ? "Overdue Alert" : "Deadline Reminder",
    categoryBadgeColor: badgeColor,
    heading: isOverdue ? `Timeline Overdue: ${taskTitle}` : `Due Soon: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Open Task in Workspace",
    showAckNotice: true,
  });

  const text = `SADA OS — ${isOverdue ? "OVERDUE ALERT" : "DEADLINE REMINDER"}\n\nTask: ${taskTitle}\nClient: ${clientName}\nDeadline: ${deadline}\nStatus: ${timeInfo}\n\n${alertNote}\n\nOpen Workspace: ${actionUrl}`;

  return {
    templateId: "deadline_reminder_v1",
    templateVersion: "1.0.0",
    subject: `[SADA ${isOverdue ? "OVERDUE" : "Reminder"}] ${taskTitle} (${clientName})`,
    html,
    text,
  };
}

/**
 * 3. Revision Requested Template
 */
export function renderRevisionRequestedTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title;
  const clientName = meta.clientName || params.contextTitle || "Project";
  const reviewer = meta.reviewerName || "Review Lead";
  const feedback = meta.feedback || meta.comments || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Deliverable", value: taskTitle },
    { label: "Client Account", value: clientName },
    { label: "Reviewed By", value: reviewer },
    { label: "Action Needed", value: "Address Feedback & Resubmit", badgeColor: "#F59E0B" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Revisions have been requested on your submitted deliverable. Please address the feedback below:</p>
    ${gridHtml}
    ${renderCalloutBox("Reviewer Feedback & Required Changes", feedback, "#F59E0B")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Revision Requested",
    categoryBadgeColor: "#F59E0B",
    heading: `Revisions Requested: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Review Comments & Revise",
    showAckNotice: true,
  });

  const text = `SADA OS — Revisions Requested\n\nTask: ${taskTitle}\nClient: ${clientName}\nReviewer: ${reviewer}\n\nFeedback:\n${feedback}\n\nReview & Resubmit: ${actionUrl}`;

  return {
    templateId: "revision_requested_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Revision] Changes Requested on ${taskTitle}`,
    html,
    text,
  };
}

/**
 * 4. New Comment / Mention Template
 */
export function renderCommentMentionTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const isMention = params.eventType === "USER_MENTIONED";
  const author = meta.authorName || meta.senderName || "A team member";
  const context = meta.taskTitle || meta.projectName || params.contextTitle || "Operational Item";
  const comment = meta.commentText || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">
      <strong>${escapeHtml(author)}</strong> ${isMention ? "mentioned you in a conversation:" : "added a comment to:"} <em>${escapeHtml(context)}</em>
    </p>
    ${renderCalloutBox(`Message from ${author}`, comment, "#3B82F6")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: isMention ? "Mention" : "Comment",
    categoryBadgeColor: "#3B82F6",
    heading: isMention ? `Mentioned by ${author}` : `New Comment on ${context}`,
    contentHtml,
    actionUrl,
    actionLabel: "View Discussion & Reply",
    showAckNotice: false,
  });

  const text = `SADA OS — ${isMention ? "Mentioned in Discussion" : "New Comment"}\n\n${author}: "${comment}"\nContext: ${context}\n\nReply: ${actionUrl}`;

  return {
    templateId: "comment_mention_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Discussion] ${author} on ${context}`,
    html,
    text,
  };
}

/**
 * 5. Client Action Required Template
 */
export function renderClientActionTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const clientName = meta.clientName || params.contextTitle || "Client Account";
  const actionNeeded = meta.actionNeeded || params.title;
  const deadline = meta.deadline || "Within 48 hours";
  const details = meta.details || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Client Workspace", value: clientName },
    { label: "Required Action", value: actionNeeded },
    { label: "Timeline SLA", value: deadline, highlight: true },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">A client interaction requires operational attention or approvals in SADA OS:</p>
    ${gridHtml}
    ${renderCalloutBox("Action Description", details, "#5CE1E6")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Client Action",
    categoryBadgeColor: "#5CE1E6",
    heading: `Client Action Required: ${clientName}`,
    contentHtml,
    actionUrl,
    actionLabel: "Open Client Workspace",
    showAckNotice: true,
  });

  const text = `SADA OS — Client Action Required\n\nClient: ${clientName}\nAction: ${actionNeeded}\nTimeline: ${deadline}\n\nDetails: ${details}\n\nOpen Workspace: ${actionUrl}`;

  return {
    templateId: "client_action_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Client Action] ${clientName}: ${actionNeeded}`,
    html,
    text,
  };
}

/**
 * 6. Task Review Requested Template
 */
export function renderTaskReviewTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title;
  const clientName = meta.clientName || params.contextTitle || "Project";
  const workerName = meta.workerName || "Assigned Specialist";
  const submissionTime = meta.submittedAt || "Recently";
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Deliverable", value: taskTitle },
    { label: "Client Account", value: clientName },
    { label: "Submitted By", value: workerName },
    { label: "Submission Time", value: submissionTime },
    { label: "Review Status", value: "Ready for Sign-off", badgeColor: "#10B981" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">A deliverable has been submitted for QA verification and sign-off:</p>
    ${gridHtml}
    ${params.message ? renderCalloutBox("Submission Notes", params.message, "#10B981") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Review Required",
    categoryBadgeColor: "#10B981",
    heading: `Review Requested: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Open QA Review",
    showAckNotice: true,
  });

  const text = `SADA OS — Review Requested\n\nDeliverable: ${taskTitle}\nClient: ${clientName}\nSubmitted By: ${workerName}\nTime: ${submissionTime}\n\nReview: ${actionUrl}`;

  return {
    templateId: "task_review_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Review] Sign-off Required: ${taskTitle}`,
    html,
    text,
  };
}

/**
 * 7. Account / Security Events Template
 */
export function renderSecurityEventTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const eventDesc = params.message || "A security action or audit event occurred on your account.";
  const timestamp = meta.timestamp || new Date().toUTCString();
  const guidance = meta.guidance || "If you did not initiate this action, please secure your account immediately and alert a Super Admin.";
  const actionUrl = resolveActionUrl("/admin/accounts", params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Security Event", value: params.title },
    { label: "Audit Timestamp", value: timestamp },
    { label: "Platform", value: "SADA OS Enterprise Security" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">This security alert has been dispatched to keep your account safe:</p>
    ${gridHtml}
    ${renderCalloutBox("Security Guidance", guidance, "#EF4444")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Security Alert",
    categoryBadgeColor: "#EF4444",
    heading: params.title || "Security Notification",
    contentHtml,
    actionUrl,
    actionLabel: "Review Security Center",
    showAckNotice: false,
  });

  const text = `SADA OS — Security Alert\n\nEvent: ${params.title}\nTime: ${timestamp}\nDetails: ${eventDesc}\n\nGuidance: ${guidance}\n\nSecurity Center: ${actionUrl}`;

  return {
    templateId: "account_security_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Security] ${params.title}`,
    html,
    text,
  };
}

/**
 * 8. Billing & Finance Template
 */
export function renderBillingFinanceTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const invNumber = meta.invoiceNumber || meta.invoice_number || "Invoice";
  const clientName = meta.clientName || params.contextTitle || "Client Account";
  const amount = meta.amount || meta.totalAmount ? `${meta.amount || meta.totalAmount} TND` : "Confirmed";
  const dueDate = meta.dueDate || meta.due_date || "Past Due";
  const actionUrl = resolveActionUrl(params.linkUrl || "/admin/finance", params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Account", value: clientName },
    { label: "Reference", value: invNumber },
    { label: "Total Amount", value: amount, highlight: true },
    { label: "Due Date", value: dueDate },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">${escapeHtml(params.message)}</p>
    ${gridHtml}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Finance & Billing",
    categoryBadgeColor: "#10B981",
    heading: params.title,
    contentHtml,
    actionUrl,
    actionLabel: "Open Financial Ledger",
    showAckNotice: true,
  });

  const text = `SADA OS — Financial Notification\n\n${params.title}\nClient: ${clientName}\nReference: ${invNumber}\nAmount: ${amount}\n\n${params.message}\n\nView: ${actionUrl}`;

  return {
    templateId: "billing_finance_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Finance] ${params.title}`,
    html,
    text,
  };
}

/**
 * 9. Production & Calendar Template
 */
export function renderProductionCalendarTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const shootTitle = meta.shootTitle || params.title;
  const clientName = meta.clientName || params.contextTitle || "Client Shoot";
  const date = meta.date || "Tomorrow";
  const time = meta.time || "Scheduled Time";
  const location = meta.location || "Studio / On-Site";
  const prodType = meta.productionType || "Media Production";
  const actionUrl = resolveActionUrl(params.linkUrl || "/admin/calendar", params.notificationId, params.baseUrl);

  const gridHtml = renderDataGrid([
    { label: "Client Account", value: clientName },
    { label: "Scheduled Date", value: date, highlight: true },
    { label: "Call Time", value: time },
    { label: "Location", value: location },
    { label: "Production Scope", value: prodType },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">A production booking is scheduled on the operational calendar:</p>
    ${gridHtml}
    ${params.message ? renderCalloutBox("Schedule Notes", params.message, "#5CE1E6") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Production Calendar",
    categoryBadgeColor: "#5CE1E6",
    heading: shootTitle,
    contentHtml,
    actionUrl,
    actionLabel: "Open Production Calendar",
    showAckNotice: true,
  });

  const text = `SADA OS — Production Schedule\n\n${shootTitle}\nClient: ${clientName}\nDate: ${date} at ${time}\nLocation: ${location}\nScope: ${prodType}\n\nOpen Calendar: ${actionUrl}`;

  return {
    templateId: "production_calendar_v1",
    templateVersion: "1.0.0",
    subject: `[SADA Production] ${shootTitle} (${date})`,
    html,
    text,
  };
}

/**
 * 10. Canonical General Fallback Template
 */
export function renderCanonicalGeneralTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl);

  const contentHtml = `
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #E2E8F0;">
      ${escapeHtml(params.message)}
    </p>
    ${params.contextTitle ? renderDataGrid([{ label: "Context", value: params.contextTitle }]) : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "System Notice",
    categoryBadgeColor: "#94A3B8",
    heading: params.title,
    contentHtml,
    actionUrl,
    actionLabel: "View in SADA OS",
    showAckNotice: false,
  });

  const text = `SADA OS — Notification\n\n${params.title}\n\n${params.message}\n\nView: ${actionUrl}`;

  return {
    templateId: "canonical_general_v1",
    templateVersion: "1.0.0",
    subject: `[SADA OS] ${params.title}`,
    html,
    text,
  };
}

/**
 * Master Template Dispatcher.
 * Maps every canonical notification event type to its dedicated template.
 */
export function renderNotificationEmail(params: RenderNotificationEmailParams): RenderedEmail {
  const ev = params.eventType;

  // 1. Task Assigned
  if (ev === "TASK_ASSIGNED" || ev === "TASK_REASSIGNED") {
    return renderTaskAssignedTemplate(params);
  }

  // 2. Deadline & Overdue Reminders
  if (ev === "TASK_DUE_SOON" || ev === "TASK_OVERDUE" || ev === "TASK_DEADLINE" || ev === "DELIVERABLE_BEHIND" || ev === "REMINDER_DUE") {
    return renderDeadlineReminderTemplate(params);
  }

  // 3. Revisions
  if (ev === "TASK_REVISION_REQUESTED" || ev === "CLIENT_REVISION_REQUESTED" || ev === "REVISION_REQUESTED") {
    return renderRevisionRequestedTemplate(params);
  }

  // 4. Comments & Mentions
  if (ev === "TASK_COMMENT" || ev === "USER_MENTIONED" || ev === "MANAGER_MESSAGE") {
    return renderCommentMentionTemplate(params);
  }

  // 5. Client Action & Workspaces
  if (
    ev === "CLIENT_APPROVAL_REQUIRED" ||
    ev === "CLIENT_INFO_SUBMITTED" ||
    ev === "CLIENT_FILES_UPLOADED" ||
    ev === "WORKSPACE_STATUS_CHANGED" ||
    ev === "APPROVAL_BLOCKED" ||
    ev === "INQUIRY_RECEIVED"
  ) {
    return renderClientActionTemplate(params);
  }

  // 6. Task Reviews
  if (ev === "TASK_REVIEW_REQUESTED" || ev === "CLIENT_DELIVERABLE_APPROVED" || ev === "APPROVAL_COMPLETED" || ev === "TASK_APPROVED") {
    return renderTaskReviewTemplate(params);
  }

  // 7. Security
  if (ev === "SECURITY_AUDIT") {
    return renderSecurityEventTemplate(params);
  }

  // 8. Finance & Billing
  if (
    ev === "INVOICE_OVERDUE" ||
    ev === "PAYMENT_RECEIVED" ||
    ev === "COMMISSION_ELIGIBLE" ||
    ev === "COMMISSION_APPROVED" ||
    ev === "SALARY_PAID" ||
    ev === "DEAL_CREATED" ||
    ev === "DEAL_STATUS_CHANGED"
  ) {
    return renderBillingFinanceTemplate(params);
  }

  // 9. Production & Calendar
  if (
    ev === "PRODUCTION_TOMORROW" ||
    ev === "CALENDAR_EVENT_REMINDER" ||
    ev === "CALENDAR_SCHEDULE_CHANGED"
  ) {
    return renderProductionCalendarTemplate(params);
  }

  // 10. Fallback canonical
  return renderCanonicalGeneralTemplate(params);
}
