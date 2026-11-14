// ============================================================
// SADA OS — TRANSACTIONAL EMAIL TEMPLATE SYSTEM (LIGHT THEME)
// Premium SaaS Light Design System for Canonical Notification Events
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
 * Configured SADA Timezone (Tunis, Tunisia · UTC+1)
 */
export const SADA_TIMEZONE = process.env.SADA_TIMEZONE || process.env.TIMEZONE || "Africa/Tunis";

/**
 * Formats a date, ISO timestamp, or date-string into a clean, human-readable
 * format respecting the configured SADA timezone (Africa/Tunis).
 * Returns original text if already non-date human prose (e.g. "Immediate", "Tomorrow").
 */
export function formatSadaEmailDateTime(
  val: string | Date | number | null | undefined,
  opts: { includeTime?: boolean; fallback?: string } = {}
): string {
  if (!val) return opts.fallback || "—";
  const rawStr = String(val).trim();
  if (!rawStr) return opts.fallback || "—";

  // If already descriptive non-date string, preserve it
  if (!/^\d{4}-\d{2}-\d{2}/.test(rawStr) && isNaN(Number(rawStr))) {
    return rawStr;
  }

  try {
    const isUnixNum = !isNaN(Number(rawStr)) && Number(rawStr) > 1000000000;
    let iso = rawStr;
    if (iso.includes(" ") && !iso.includes("T")) iso = iso.replace(" ", "T") + "Z";
    else if (!iso.includes("T") && !isUnixNum) iso = `${iso}T12:00:00Z`;

    const d = isUnixNum ? new Date(Number(rawStr)) : new Date(iso);
    if (isNaN(d.getTime())) return rawStr;

    const hasTime = (rawStr.includes("T") || rawStr.includes(" ") || isUnixNum) && (opts.includeTime ?? true);

    if (hasTime) {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: SADA_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(d);
    } else {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: SADA_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    }
  } catch (_) {
    return rawStr;
  }
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
export function resolveActionUrl(
  linkUrl?: string,
  notificationId?: string,
  baseUrl = "https://sada.agency",
  options?: { isOperational?: boolean }
): string {
  const origin = (process.env.APP_BASE_URL || process.env.VITE_APP_URL || baseUrl).replace(/\/$/, "");
  let path = linkUrl || "/admin";
  if (!path.startsWith("/")) path = "/" + path;

  const urlParams = new URLSearchParams();
  if (notificationId) {
    urlParams.set("notif", notificationId);
  }
  if (options?.isOperational) {
    urlParams.set("ack", "1");
  }
  urlParams.set("utm_source", "email_resend");
  urlParams.set("utm_medium", "transactional_email");

  const separator = path.includes("?") ? "&" : "?";
  return `${origin}${path}${separator}${urlParams.toString()}`;
}

/**
 * Computes light-theme color tokens for badges based on primary accent color.
 */
function getBadgeColors(categoryColor: string): { bg: string; border: string; text: string } {
  const c = categoryColor.toUpperCase();
  if (c === "#DC2626" || c === "#EF4444") {
    return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
  }
  if (c === "#D97706" || c === "#F59E0B") {
    return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" };
  }
  if (c === "#059669" || c === "#10B981") {
    return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
  }
  if (c === "#64748B" || c === "#94A3B8") {
    return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
  }
  // Default SADA Blue (#0878E8) or Cyan (#5CE1E6)
  return { bg: "#EFF6FF", border: "#BFDBFE", text: "#0878E8" };
}

/**
 * Core SADA Premium Light Email HTML Shell.
 * Clean, modern enterprise design system.
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
  const baseUrlOrigin = actionUrl.match(/^(https?:\/\/[^\/?#]+)/)?.[1] || "https://sada.agency";
  const settingsUrl = `${baseUrlOrigin}/admin/settings`;
  const badgeColors = getBadgeColors(categoryBadgeColor);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
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
      background-color: #F4F7FB;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #111827;
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
      background-color: #FFFFFF;
      border: 1px solid #E5EAF0;
      border-radius: 12px;
      overflow: hidden;
      table-layout: fixed;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .cta-button {
      display: inline-block;
      padding: 13px 28px;
      background-color: #0878E8;
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(8, 120, 232, 0.25);
      box-sizing: border-box;
      text-align: center;
      min-height: 44px;
      line-height: 18px;
    }
    .cta-button:hover {
      background-color: #0764C4 !important;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
      }
      .content-padding {
        padding: 20px 16px !important;
      }
      .header-padding {
        padding: 18px 16px 14px 16px !important;
      }
      .footer-padding {
        padding: 18px 16px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        padding: 13px 16px !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #F4F7FB; color: #111827;">
  <center style="width: 100%; table-layout: fixed; background-color: #F4F7FB;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F4F7FB; table-layout: fixed;">
      <tr>
        <td align="center" style="padding: 12px 8px;">
          
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E5EAF0; border-radius: 12px; overflow: hidden; table-layout: fixed; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
            
            <!-- Top Gradient Accent Line -->
            <tr>
              <td style="height: 3px; background: linear-gradient(90deg, #0878E8 0%, #5CE1E6 100%); line-height: 3px; font-size: 1px;">&nbsp;</td>
            </tr>

            <!-- HEADER -->
            <tr>
              <td class="header-padding" style="padding: 22px 28px 18px 28px; border-bottom: 1px solid #E5EAF0; background-color: #FFFFFF;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
                  <tr>
                    <td align="left" valign="middle">
                      <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.12em; color: #111827; text-transform: uppercase;">
                        SADA <span style="color: #0878E8; font-size: 16px;">·</span> <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.18em; color: #64748B;">OPERATING SYSTEM</span>
                      </div>
                    </td>
                    <td align="right" valign="middle" style="width: 45%;">
                      <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 9999px; background-color: ${badgeColors.bg}; color: ${badgeColors.text}; border: 1px solid ${badgeColors.border}; white-space: nowrap;">
                        ${escapeHtml(categoryLabel)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- MAIN BODY -->
            <tr>
              <td class="content-padding" style="padding: 28px; background-color: #FFFFFF; word-break: break-word; overflow-wrap: break-word;">
                <!-- Main Event Heading -->
                <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; line-height: 1.35; color: #111827; letter-spacing: -0.01em; word-break: break-word; overflow-wrap: break-word;">
                  ${escapeHtml(heading)}
                </h1>

                <!-- Event Specific Content (concise sentence, data grid, callout) -->
                <div style="font-size: 14px; line-height: 1.6; color: #475569; word-break: break-word; overflow-wrap: break-word;">
                  ${contentHtml}
                </div>

                <!-- Action Button CTA -->
                <div style="margin-top: 28px; text-align: center;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(actionUrl)}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="16%" stroke="f" fillcolor="#0878E8">
                    <w:anchorlock/>
                    <center style="color:#FFFFFF;font-family:sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(actionLabel)}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${escapeHtml(actionUrl)}" class="cta-button" style="display: inline-block; padding: 13px 28px; background-color: #0878E8; color: #FFFFFF; font-size: 14px; font-weight: 700; letter-spacing: 0.01em; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 8px rgba(8, 120, 232, 0.25); max-width: 100%; box-sizing: border-box;">
                    ${escapeHtml(actionLabel)} &rarr;
                  </a>
                  <!--<![endif]-->
                </div>

                ${showAckNotice ? `
                <!-- Small Secondary Operational Acknowledgment Note -->
                <div style="margin-top: 20px; padding: 10px 14px; background-color: #F8FAFC; border: 1px solid #E5EAF0; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #64748B; text-align: center; word-break: break-word;">
                  Please acknowledge this task inside SADA OS. Opening this email does not confirm receipt (does not constitute official acknowledgment).
                </div>
                ` : ""}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td class="footer-padding" style="padding: 20px 28px; background-color: #F8FAFC; border-top: 1px solid #E5EAF0; text-align: center; font-size: 12px; line-height: 1.6; color: #64748B; word-break: break-word;">
                <p style="margin: 0 0 6px 0; color: #64748B; font-weight: 500;">
                  Automated notification from <strong style="color: #111827;">SADA Operating System</strong>
                </p>
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #94A3B8;">
                  Confidential & Proprietary · SADA Digital Luxe · Tunis (${SADA_TIMEZONE})
                </p>
                <p style="margin: 0; font-size: 11px;">
                  <a href="${escapeHtml(actionUrl)}" style="color: #0878E8; text-decoration: underline; font-weight: 600;">Open SADA OS Dashboard</a>
                  <span style="color: #CBD5E1; margin: 0 6px;">·</span>
                  <a href="${escapeHtml(settingsUrl)}" style="color: #64748B; text-decoration: underline;">Notification Preferences</a>
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
 * Builds a structured key-value metadata panel with table-layout: fixed to prevent overflow.
 * Light theme styling: #F8FAFC background, #E5EAF0 border, #64748B label, #111827 value.
 */
function renderDataGrid(items: { label: string; value: string; highlight?: boolean; badgeColor?: string }[]): string {
  const validItems = items.filter(item => Boolean(item.value));
  const rows = validItems
    .map((item, idx) => {
      const isLast = idx === validItems.length - 1;
      const borderStyle = isLast ? "" : "border-bottom: 1px solid #E5EAF0;";

      let valueDisplay = escapeHtml(item.value);
      if (item.badgeColor) {
        const badgeColors = getBadgeColors(item.badgeColor);
        valueDisplay = `<span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: ${badgeColors.bg}; color: ${badgeColors.text}; border: 1px solid ${badgeColors.border};">${valueDisplay}</span>`;
      } else if (item.highlight) {
        valueDisplay = `<span style="color: #0878E8; font-weight: 700;">${valueDisplay}</span>`;
      }

      return `
        <tr>
          <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748B; width: 36%; ${borderStyle} vertical-align: top; word-break: break-word;">
            ${escapeHtml(item.label)}
          </td>
          <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #111827; ${borderStyle} vertical-align: top; word-break: break-word;">
            ${valueDisplay}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0 20px 0; background-color: #F8FAFC; border: 1px solid #E5EAF0; border-radius: 8px; overflow: hidden; table-layout: fixed; width: 100%;">
      ${rows}
    </table>
  `;
}

/**
 * Builds a callout quote / feedback box.
 * Light theme styling: #F8FAFC background, #E5EAF0 border, left accent line, #334155 text.
 */
function renderCalloutBox(title: string, body: string, accentColor = "#0878E8"): string {
  return `
    <div style="margin: 16px 0; padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E5EAF0; border-left: 3px solid ${accentColor}; border-radius: 0 6px 6px 0; word-break: break-word;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${accentColor}; margin-bottom: 4px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #334155;">
        ${escapeHtml(body)}
      </div>
    </div>
  `;
}

// ============================================================
// TEMPLATE HANDLERS (10 DEDICATED LIGHT-THEME TEMPLATES)
// ============================================================

/**
 * 1. Task Assigned Template
 * CTA: "Open Task"
 */
export function renderTaskAssignedTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title.replace(/^Task Assigned:\s*/i, "");
  const clientName = meta.clientName || params.contextTitle || "SADA Internal";
  const priority = (meta.priority || "normal").toUpperCase();
  const deadline = formatSadaEmailDateTime(meta.deadline, { fallback: "Not specified" });
  const assignedBy = meta.assignedByName || meta.assignedBy || "Project Lead";
  const description = meta.description || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Client / Project", value: clientName },
    { label: "Priority", value: priority, badgeColor: priority === "URGENT" || priority === "HIGH" ? "#DC2626" : "#0878E8" },
    { label: "Deadline", value: deadline, highlight: true },
    { label: "Assigned By", value: assignedBy },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">A new deliverable has been assigned to you in SADA OS.</p>
    ${gridHtml}
    ${description ? renderCalloutBox("Task Brief / Scope", description, "#0878E8") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Task Assigned",
    categoryBadgeColor: "#0878E8",
    heading: `Task Assigned: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Open Task",
    showAckNotice: true,
  });

  const text = `SADA OS — Task Assigned\n\nTask: ${taskTitle}\nClient: ${clientName}\nPriority: ${priority}\nDeadline: ${deadline}\nAssigned By: ${assignedBy}\n\nBrief:\n${description}\n\nOpen Task: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "task_assigned_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Task] Assigned: ${taskTitle} (${clientName})`,
    html,
    text,
  };
}

/**
 * 2. Deadline Reminder & 3. Overdue Task Template
 * Non-overdue CTA: "View Task & Deadline"
 * Overdue CTA: "Resolve Overdue Task"
 */
export function renderDeadlineReminderTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const isOverdue = params.eventType === "TASK_OVERDUE" || params.eventType === "DELIVERABLE_BEHIND";
  const taskTitle = meta.taskTitle || params.title.replace(/^(Due Soon|Overdue):\s*/i, "");
  const clientName = meta.clientName || params.contextTitle || "Deliverable";
  const deadline = formatSadaEmailDateTime(meta.deadline, { fallback: isOverdue ? "Immediate" : "Approaching" });
  const timeInfo = meta.remainingTime || meta.overdueDuration || (isOverdue ? "Deadline Passed" : "Due Soon");
  const currentStatus = (meta.status || "In Progress").toUpperCase();
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const badgeColor = isOverdue ? "#DC2626" : "#D97706";
  const categoryLabel = isOverdue ? "Overdue Task" : "Deadline Reminder";
  const actionLabel = isOverdue ? "Resolve Overdue Task" : "View Task & Deadline";
  const heading = isOverdue ? `Overdue: ${taskTitle}` : `Due Soon: ${taskTitle}`;
  const conciseSentence = isOverdue
    ? "This deliverable has exceeded its scheduled completion window and requires immediate resolution."
    : "This deliverable is approaching its scheduled deadline and requires your prompt attention.";

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
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">${conciseSentence}</p>
    ${gridHtml}
    ${renderCalloutBox(isOverdue ? "CRITICAL TIMELINE ALERT" : "DEADLINE NOTICE", alertNote, badgeColor)}
  `;

  const html = wrapInSadaLayout({
    categoryLabel,
    categoryBadgeColor: badgeColor,
    heading,
    contentHtml,
    actionUrl,
    actionLabel,
    showAckNotice: true,
  });

  const text = `SADA OS — ${isOverdue ? "OVERDUE ALERT" : "DEADLINE REMINDER"}\n\nTask: ${taskTitle}\nClient: ${clientName}\nDeadline: ${deadline}\nStatus: ${timeInfo}\n\n${alertNote}\n\n${actionLabel}: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "deadline_reminder_v1",
    templateVersion: "2.0.0",
    subject: `[SADA ${isOverdue ? "OVERDUE" : "Reminder"}] ${taskTitle} (${clientName})`,
    html,
    text,
  };
}

/**
 * 4. Revision Requested Template
 * CTA: "Review Requested Changes"
 */
export function renderRevisionRequestedTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title.replace(/^Revisions? Requested:\s*/i, "");
  const clientName = meta.clientName || params.contextTitle || "Project";
  const reviewer = meta.reviewerName || "Review Lead";
  const feedback = meta.feedback || meta.comments || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Deliverable", value: taskTitle },
    { label: "Client Account", value: clientName },
    { label: "Reviewed By", value: reviewer },
    { label: "Action Needed", value: "Address Feedback & Resubmit", badgeColor: "#D97706" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">Revisions have been requested on your submitted deliverable.</p>
    ${gridHtml}
    ${renderCalloutBox("Reviewer Feedback & Required Changes", feedback, "#D97706")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Revision Requested",
    categoryBadgeColor: "#D97706",
    heading: `Revisions Requested: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Review Requested Changes",
    showAckNotice: true,
  });

  const text = `SADA OS — Revisions Requested\n\nTask: ${taskTitle}\nClient: ${clientName}\nReviewer: ${reviewer}\n\nFeedback:\n${feedback}\n\nReview Requested Changes: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "revision_requested_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Revision] Changes Requested on ${taskTitle}`,
    html,
    text,
  };
}

/**
 * 5. New Comment / Mention Template
 * CTA: "View Comment"
 */
export function renderCommentMentionTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const isMention = params.eventType === "USER_MENTIONED";
  const author = meta.authorName || meta.senderName || "A team member";
  const context = meta.taskTitle || meta.projectName || params.contextTitle || "Operational Item";
  const comment = meta.commentText || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      <strong>${escapeHtml(author)}</strong> ${isMention ? "mentioned you in a discussion regarding" : "commented on"} <em>${escapeHtml(context)}</em>.
    </p>
    ${renderCalloutBox(`Message from ${author}`, comment, "#0878E8")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: isMention ? "Mention" : "Comment",
    categoryBadgeColor: "#0878E8",
    heading: isMention ? `Mentioned by ${author}` : `New Comment on ${context}`,
    contentHtml,
    actionUrl,
    actionLabel: "View Comment",
    showAckNotice: true,
  });

  const text = `SADA OS — ${isMention ? "Mentioned in Discussion" : "New Comment"}\n\n${author}: "${comment}"\nContext: ${context}\n\nView Comment: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "comment_mention_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Discussion] ${author} on ${context}`,
    html,
    text,
  };
}

/**
 * 6. Client Action Required Template
 * CTA: "Review Client Request"
 */
export function renderClientActionTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const clientName = meta.clientName || params.contextTitle || "Client Account";
  const actionNeeded = meta.actionNeeded || params.title.replace(/^Client Action Required:\s*/i, "");
  const deadline = formatSadaEmailDateTime(meta.deadline, { fallback: "Within 48 hours" });
  const details = meta.details || params.message;
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Client Workspace", value: clientName },
    { label: "Required Action", value: actionNeeded },
    { label: "Timeline SLA", value: deadline, highlight: true },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">A client interaction requires operational attention or approval.</p>
    ${gridHtml}
    ${details ? renderCalloutBox("Action Description", details, "#0878E8") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Client Action",
    categoryBadgeColor: "#0878E8",
    heading: `Client Action Required: ${clientName}`,
    contentHtml,
    actionUrl,
    actionLabel: "Review Client Request",
    showAckNotice: true,
  });

  const text = `SADA OS — Client Action Required\n\nClient: ${clientName}\nAction: ${actionNeeded}\nTimeline: ${deadline}\n\nDetails: ${details}\n\nReview Client Request: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "client_action_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Client Action] ${clientName}: ${actionNeeded}`,
    html,
    text,
  };
}

/**
 * 7. Task Review Requested Template
 * CTA: "Review Submission"
 */
export function renderTaskReviewTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const taskTitle = meta.taskTitle || params.title.replace(/^Review Requested:\s*/i, "");
  const clientName = meta.clientName || params.contextTitle || "Project";
  const workerName = meta.workerName || "Assigned Specialist";
  const submissionTime = formatSadaEmailDateTime(meta.submittedAt, { fallback: "Recently" });
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Deliverable", value: taskTitle },
    { label: "Client Account", value: clientName },
    { label: "Submitted By", value: workerName },
    { label: "Submission Time", value: submissionTime },
    { label: "Review Status", value: "Ready for Sign-off", badgeColor: "#059669" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">A deliverable has been submitted for QA verification and sign-off.</p>
    ${gridHtml}
    ${params.message ? renderCalloutBox("Submission Notes", params.message, "#059669") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Review Required",
    categoryBadgeColor: "#059669",
    heading: `Review Requested: ${taskTitle}`,
    contentHtml,
    actionUrl,
    actionLabel: "Review Submission",
    showAckNotice: true,
  });

  const text = `SADA OS — Review Requested\n\nDeliverable: ${taskTitle}\nClient: ${clientName}\nSubmitted By: ${workerName}\nTime: ${submissionTime}\n\nReview Submission: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "task_review_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Review] Sign-off Required: ${taskTitle}`,
    html,
    text,
  };
}

/**
 * 8. Account / Security Events Template
 * CTA: "Review Account Security"
 */
export function renderSecurityEventTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const eventDesc = params.message || "A security action or audit event occurred on your account.";
  const timestamp = formatSadaEmailDateTime(meta.timestamp || new Date().toISOString(), { includeTime: true });
  const guidance = meta.guidance || "If you did not initiate this action, please secure your account immediately and alert a Super Admin.";
  const actionUrl = resolveActionUrl("/admin/accounts", params.notificationId, params.baseUrl, { isOperational: false });

  const gridHtml = renderDataGrid([
    { label: "Security Event", value: params.title },
    { label: "Audit Timestamp", value: timestamp },
    { label: "Platform", value: "SADA OS Enterprise Security" },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">A security-sensitive event was recorded on your SADA OS account.</p>
    ${gridHtml}
    ${renderCalloutBox("Security Guidance", guidance, "#DC2626")}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Security Alert",
    categoryBadgeColor: "#DC2626",
    heading: params.title || "Security Notification",
    contentHtml,
    actionUrl,
    actionLabel: "Review Account Security",
    showAckNotice: false,
  });

  const text = `SADA OS — Security Alert\n\nEvent: ${params.title}\nTime: ${timestamp}\nDetails: ${eventDesc}\n\nGuidance: ${guidance}\n\nReview Account Security: ${actionUrl}`;

  return {
    templateId: "account_security_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Security] ${params.title}`,
    html,
    text,
  };
}

/**
 * 9. Billing & Finance Template
 * CTA: "View Transaction"
 */
export function renderBillingFinanceTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const invNumber = meta.invoiceNumber || meta.invoice_number || "Invoice";
  const clientName = meta.clientName || params.contextTitle || "Client Account";
  const amount = meta.amount || meta.totalAmount ? `${meta.amount || meta.totalAmount} TND` : "Confirmed";
  const dueDate = formatSadaEmailDateTime(meta.dueDate || meta.due_date, { fallback: "Past Due" });
  const actionUrl = resolveActionUrl(params.linkUrl || "/admin/finance", params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Account", value: clientName },
    { label: "Reference", value: invNumber },
    { label: "Total Amount", value: amount, highlight: true },
    { label: "Due Date", value: dueDate },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">${escapeHtml(params.message)}</p>
    ${gridHtml}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Finance & Billing",
    categoryBadgeColor: "#059669",
    heading: params.title,
    contentHtml,
    actionUrl,
    actionLabel: "View Transaction",
    showAckNotice: true,
  });

  const text = `SADA OS — Financial Notification\n\n${params.title}\nClient: ${clientName}\nReference: ${invNumber}\nAmount: ${amount}\n\n${params.message}\n\nView Transaction: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "billing_finance_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Finance] ${params.title}`,
    html,
    text,
  };
}

/**
 * 10. Production & Calendar Template
 * CTA: "View Schedule"
 */
export function renderProductionCalendarTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const meta = params.metadata || {};
  const shootTitle = meta.shootTitle || params.title;
  const clientName = meta.clientName || params.contextTitle || "Client Shoot";
  const date = formatSadaEmailDateTime(meta.date || meta.scheduledDate, { includeTime: false, fallback: "Tomorrow" });
  const time = meta.time || "Scheduled Time";
  const location = meta.location || "Studio / On-Site";
  const prodType = meta.productionType || "Media Production";
  const actionUrl = resolveActionUrl(params.linkUrl || "/admin/calendar", params.notificationId, params.baseUrl, { isOperational: true });

  const gridHtml = renderDataGrid([
    { label: "Client Account", value: clientName },
    { label: "Scheduled Date", value: date, highlight: true },
    { label: "Call Time", value: time },
    { label: "Location", value: location },
    { label: "Production Scope", value: prodType },
  ]);

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">A production booking is scheduled on the operational calendar.</p>
    ${gridHtml}
    ${params.message ? renderCalloutBox("Schedule Notes", params.message, "#0878E8") : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "Production Calendar",
    categoryBadgeColor: "#0878E8",
    heading: shootTitle,
    contentHtml,
    actionUrl,
    actionLabel: "View Schedule",
    showAckNotice: true,
  });

  const text = `SADA OS — Production Schedule\n\n${shootTitle}\nClient: ${clientName}\nDate: ${date} at ${time}\nLocation: ${location}\nScope: ${prodType}\n\nView Schedule: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "production_calendar_v1",
    templateVersion: "2.0.0",
    subject: `[SADA Production] ${shootTitle} (${date})`,
    html,
    text,
  };
}

/**
 * 11. Canonical General Fallback Template
 * CTA: "View in SADA OS"
 */
export function renderCanonicalGeneralTemplate(params: RenderNotificationEmailParams): RenderedEmail {
  const actionUrl = resolveActionUrl(params.linkUrl, params.notificationId, params.baseUrl, { isOperational: true });

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      ${escapeHtml(params.message)}
    </p>
    ${params.contextTitle ? renderDataGrid([{ label: "Context", value: params.contextTitle }]) : ""}
  `;

  const html = wrapInSadaLayout({
    categoryLabel: "System Notice",
    categoryBadgeColor: "#64748B",
    heading: params.title,
    contentHtml,
    actionUrl,
    actionLabel: "View in SADA OS",
    showAckNotice: true,
  });

  const text = `SADA OS — Notification\n\n${params.title}\n\n${params.message}\n\nView in SADA OS: ${actionUrl}\n\nPlease acknowledge this task inside SADA OS. Opening this email does not confirm receipt.`;

  return {
    templateId: "canonical_general_v1",
    templateVersion: "2.0.0",
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
