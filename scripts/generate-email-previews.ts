// ============================================================
// SADA OS — EMAIL TEMPLATES VISUAL ACCEPTANCE PREVIEW GENERATOR
// Renders all 10 Premium Light Theme Transactional Templates
// Generates standalone HTML files and responsive index in .output/email-previews/
// ============================================================

import fs from "fs";
import path from "path";
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
  escapeHtml,
  type RenderedEmail,
} from "../src/server/email-templates";

const OUTPUT_DIR = path.resolve(process.cwd(), ".output/email-previews");
const DOCS_DIR = path.resolve(process.cwd(), "docs/email-previews");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

interface TemplateScenario {
  id: string;
  name: string;
  expectedCta: string;
  isOperational: boolean;
  generator: () => RenderedEmail;
}

const scenarios: TemplateScenario[] = [
  {
    id: "01_task_assigned",
    name: "1. Task Assigned",
    expectedCta: "Open Task",
    isOperational: true,
    generator: () =>
      renderTaskAssignedTemplate({
        eventType: "TASK_ASSIGNED",
        title: "Task Assigned: 4K Color Grading Deliverable",
        message: "Final grading and master reel conform for luxury campaign.",
        contextTitle: "Hermès Paris Campaign",
        notificationId: "notif_preview_001",
        linkUrl: "/admin/tasks/hermes-color-01",
        metadata: {
          taskTitle: "4K Color Grading Reel",
          clientName: "Hermès Paris",
          deadline: "2026-11-20T17:00:00Z",
          assignedByName: "Boubakar Hamed (Creative Director)",
          priority: "urgent",
          description: "Deliver Prores 4444 master with Rec.709 and HDR10 deliverables. Review anamorphic lens flare matching on shot 14.",
        },
      }),
  },
  {
    id: "02_deadline_reminder",
    name: "2. Deadline Reminder (Due Soon)",
    expectedCta: "View Task & Deadline",
    isOperational: true,
    generator: () =>
      renderDeadlineReminderTemplate({
        eventType: "TASK_DUE_SOON",
        title: "Due Soon: Social Media Cutdown Reel",
        message: "Scheduled delivery window closing within 24 hours.",
        contextTitle: "Cartier Joaillerie",
        notificationId: "notif_preview_002",
        linkUrl: "/admin/tasks/cartier-cutdown-02",
        metadata: {
          taskTitle: "Social Media Cutdown Reel",
          clientName: "Cartier Joaillerie",
          deadline: "2026-11-18T12:00:00Z",
          remainingTime: "Due in 18 Hours",
          status: "In Review",
        },
      }),
  },
  {
    id: "03_overdue_task",
    name: "3. Overdue Task",
    expectedCta: "Resolve Overdue Task",
    isOperational: true,
    generator: () =>
      renderDeadlineReminderTemplate({
        eventType: "TASK_OVERDUE",
        title: "Overdue: Sound Design Master Track",
        message: "Scheduled delivery window elapsed 6 hours ago.",
        contextTitle: "Rolex Middle East",
        notificationId: "notif_preview_003",
        linkUrl: "/admin/tasks/rolex-audio-03",
        metadata: {
          taskTitle: "Sound Design Master Track",
          clientName: "Rolex Middle East",
          deadline: "2026-11-14T10:00:00Z",
          overdueDuration: "Overdue by 6h",
          status: "Blocked",
        },
      }),
  },
  {
    id: "04_revision_requested",
    name: "4. Revision Requested",
    expectedCta: "Review Requested Changes",
    isOperational: true,
    generator: () =>
      renderRevisionRequestedTemplate({
        eventType: "TASK_REVISION_REQUESTED",
        title: "Revisions Requested: Typography Motion Sequence",
        message: "Please adjust tracking and baseline alignment on final slate.",
        contextTitle: "Bvlgari Haute Horlogerie",
        notificationId: "notif_preview_004",
        linkUrl: "/admin/tasks/bvlgari-motion-04",
        metadata: {
          taskTitle: "Typography Motion Sequence",
          clientName: "Bvlgari Haute Horlogerie",
          reviewerName: "Amine Sghaier (Lead Designer)",
          feedback: "The serif font kerning on the Roman numerals requires looser tracking (+40). Tone down the bloom pass by 15%.",
        },
      }),
  },
  {
    id: "05_comment_mention",
    name: "5. Comment / Mention",
    expectedCta: "View Comment",
    isOperational: true,
    generator: () =>
      renderCommentMentionTemplate({
        eventType: "USER_MENTIONED",
        title: "Mentioned in Production Chat",
        message: "@Boubakar can you verify the anamorphic squeeze factor before final export?",
        contextTitle: "Balenciaga Winter Reel",
        notificationId: "notif_preview_005",
        linkUrl: "/admin/tasks/balenciaga-reel-05",
        metadata: {
          authorName: "Sarah Karray",
          projectName: "Balenciaga Winter Reel",
          commentText: "@Boubakar can you verify the anamorphic squeeze factor before final export? Client wants 2.39:1 theatrical framing.",
        },
      }),
  },
  {
    id: "06_client_action",
    name: "6. Client Action Required",
    expectedCta: "Review Client Request",
    isOperational: true,
    generator: () =>
      renderClientActionTemplate({
        eventType: "CLIENT_APPROVAL_REQUIRED",
        title: "Client Action Required: Brand Visual Treatment Sign-off",
        message: "Client brand team submitted feedback on commercial visual treatment.",
        contextTitle: "Dior Beauty Commercial",
        notificationId: "notif_preview_006",
        linkUrl: "/admin/clients/dior-commercial-06",
        metadata: {
          clientName: "Dior Beauty",
          actionNeeded: "Review & approve revised storyboard lighting setup",
          deadline: "2026-11-19T16:00:00Z",
          details: "Client requested golden hour lighting palette shift for scene 3 and approved casting selection for lead talent.",
        },
      }),
  },
  {
    id: "07_task_review",
    name: "7. Task Review Requested",
    expectedCta: "Review Submission",
    isOperational: true,
    generator: () =>
      renderTaskReviewTemplate({
        eventType: "TASK_REVIEW_REQUESTED",
        title: "Review Requested: 3D CGI Glass Bottle Simulation",
        message: "Simulation pass 3 rendered and ready for senior supervisor sign-off.",
        contextTitle: "Chanel Perfume Launch",
        notificationId: "notif_preview_007",
        linkUrl: "/admin/tasks/chanel-3d-07",
        metadata: {
          taskTitle: "3D CGI Glass Bottle Simulation",
          clientName: "Chanel Fragrance",
          workerName: "Karim Ben Amor (3D VFX Lead)",
          submittedAt: "2026-11-14T15:45:00Z",
        },
      }),
  },
  {
    id: "08_security_event",
    name: "8. Account Security Alert",
    expectedCta: "Review Account Security",
    isOperational: false,
    generator: () =>
      renderSecurityEventTemplate({
        eventType: "SECURITY_AUDIT",
        title: "New Administrative Session Authorized",
        message: "A new administrative session was established from Chrome on macOS in Tunis (IP: 197.14.22.45).",
        notificationId: "notif_preview_008",
        metadata: {
          timestamp: "2026-11-14T17:30:00Z",
          guidance: "If you did not authenticate this session, revoke all active sessions immediately and reset your password.",
        },
      }),
  },
  {
    id: "09_billing_finance",
    name: "9. Billing & Finance Event",
    expectedCta: "View Transaction",
    isOperational: true,
    generator: () =>
      renderBillingFinanceTemplate({
        eventType: "INVOICE_OVERDUE",
        title: "Invoice Past Due: INV-2026-0089",
        message: "Scheduled settlement date for commercial media campaign retainer has elapsed.",
        contextTitle: "Saint Laurent Retainer",
        notificationId: "notif_preview_009",
        linkUrl: "/admin/finance/invoices/inv-0089",
        metadata: {
          clientName: "Yves Saint Laurent",
          invoiceNumber: "INV-2026-0089",
          amount: "28,400",
          dueDate: "2026-11-10",
        },
      }),
  },
  {
    id: "10_production_calendar",
    name: "10. Production & Calendar Event",
    expectedCta: "View Schedule",
    isOperational: true,
    generator: () =>
      renderProductionCalendarTemplate({
        eventType: "PRODUCTION_TOMORROW",
        title: "Call Sheet: Studio High-Jewelry Commercial",
        message: "Studio call time 07:30 AM sharp at Studio SADA Tunis. Full camera and lighting package pre-rigged.",
        contextTitle: "Van Cleef & Arpels",
        notificationId: "notif_preview_010",
        linkUrl: "/admin/calendar/shoot-van-cleef",
        metadata: {
          shootTitle: "Van Cleef Haute Horlogerie Shoot",
          clientName: "Van Cleef & Arpels",
          date: "2026-11-15",
          time: "07:30 AM (Call Time)",
          location: "Studio SADA Tunis · Stage B",
          productionType: "Macro High-Speed 4K Cinema",
        },
      }),
  },
  {
    id: "11_canonical_fallback",
    name: "11. Canonical General Fallback",
    expectedCta: "View in SADA OS",
    isOperational: true,
    generator: () =>
      renderCanonicalGeneralTemplate({
        eventType: "ANNOUNCEMENT" as any,
        title: "SADA OS Platform Update v3.2 Deployed",
        message: "Platform maintenance successfully completed. Resend transactional email light theme and delivery engines are active.",
        contextTitle: "System Infrastructure",
        notificationId: "notif_preview_011",
        linkUrl: "/admin",
      }),
  },
];

console.log("\n============================================================");
console.log("   GENERATING SADA OS LIGHT EMAIL TEMPLATE PREVIEWS   ");
console.log("============================================================\n");

let auditFailures = 0;

for (const scenario of scenarios) {
  const rendered = scenario.generator();
  const filePath = path.join(OUTPUT_DIR, `${scenario.id}.html`);
  const textFilePath = path.join(OUTPUT_DIR, `${scenario.id}.txt`);

  fs.writeFileSync(filePath, rendered.html, "utf-8");
  fs.writeFileSync(textFilePath, rendered.text, "utf-8");
  fs.writeFileSync(path.join(DOCS_DIR, `${scenario.id}.html`), rendered.html, "utf-8");
  fs.writeFileSync(path.join(DOCS_DIR, `${scenario.id}.txt`), rendered.text, "utf-8");

  // Audit assertions
  const errors: string[] = [];

  // 1. Light Theme Colors
  if (!rendered.html.includes("#F4F7FB")) errors.push("Missing canvas background #F4F7FB");
  if (!rendered.html.includes("#FFFFFF")) errors.push("Missing card background #FFFFFF");
  if (rendered.html.includes("#0D1527")) errors.push("Contains deprecated dark navy #0D1527");
  if (rendered.html.includes("#080D1A")) errors.push("Contains deprecated dark canvas #080D1A");

  // 2. Exact CTA Copy
  const expectedEscapedCta = escapeHtml(scenario.expectedCta);
  if (!rendered.html.includes(expectedEscapedCta)) {
    errors.push(`Missing expected CTA label: '${scenario.expectedCta}' (searched for '${expectedEscapedCta}')`);
  }

  // 3. Operational Acknowledgment Note
  if (scenario.isOperational) {
    if (!rendered.html.includes("Please acknowledge this task inside SADA OS. Opening this email does not confirm receipt")) {
      errors.push("Missing mandatory operational acknowledgment notice");
    }
  }

  // 4. No Raw ISO dates (e.g. 2026-XX-XXT)
  const rawIsoMatch = rendered.html.match(/2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (rawIsoMatch) {
    errors.push(`Contains unformatted raw ISO date: ${rawIsoMatch[0]}`);
  }

  // 5. Overflow safety
  if (!rendered.html.includes("table-layout: fixed")) errors.push("Missing table-layout: fixed");
  if (!rendered.html.includes("word-break: break-word")) errors.push("Missing word-break: break-word");
  if (!rendered.html.includes("max-width: 600px")) errors.push("Missing max-width: 600px");

  if (errors.length > 0) {
    auditFailures++;
    console.error(`❌ ${scenario.name}:`);
    errors.forEach((err) => console.error(`   - ${err}`));
  } else {
    console.log(`✅ ${scenario.name} -> ${scenario.id}.html (CTA: "${scenario.expectedCta}")`);
  }
}

// Generate Index Catalog HTML
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SADA OS — Transactional Email Light Design System Catalog</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F1F5F9; color: #0F172A; margin: 0; padding: 32px; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    p { color: #64748B; font-size: 14px; margin-top: 0; }
    .nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin: 24px 0; }
    .card { background: white; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; transition: transform 0.15s, box-shadow 0.15s; text-decoration: none; color: inherit; display: block; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.06); border-color: #0878E8; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #EFF6FF; color: #0878E8; margin-bottom: 8px; }
    .cta-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #F8FAFC; border: 1px solid #E2E8F0; color: #334155; }
    .title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
    .preview-container { margin-top: 40px; background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; }
    iframe { border: 1px solid #E2E8F0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>SADA OS — Transactional Email Light Design System</h1>
  <p>10 Canonical Notification Templates + Fallback · Clean Premium SaaS Light Theme · Resend Tested</p>
  
  <div class="nav-grid">
    ${scenarios
      .map(
        (s) => `
      <a href="${s.id}.html" target="previewFrame" class="card">
        <span class="badge">Template</span>
        <div class="title">${s.name}</div>
        <div class="cta-badge">CTA: ${s.expectedCta}</div>
      </a>
    `
      )
      .join("")}
  </div>

  <div class="preview-container">
    <h2 style="font-size: 18px; margin-top: 0;">Interactive Live Preview</h2>
    <p style="font-size: 13px; color: #64748B;">Click any card above to view it in the iframe below, or open each HTML file directly in any browser.</p>
    <div style="display: flex; gap: 24px; flex-wrap: wrap;">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 8px;">DESKTOP VIEW (600px Max-Width Canvas)</div>
        <iframe name="previewFrame" src="01_task_assigned.html" width="640" height="750"></iframe>
      </div>
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 8px;">MOBILE VIEW (375px Fluid Canvas)</div>
        <iframe src="01_task_assigned.html" width="375" height="750"></iframe>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), indexHtml, "utf-8");
fs.writeFileSync(path.join(DOCS_DIR, "index.html"), indexHtml, "utf-8");
console.log(`\n🎉 Generated interactive preview catalog at: .output/email-previews/index.html & docs/email-previews/index.html`);

if (auditFailures > 0) {
  console.error(`\n❌ Preview audit failed with ${auditFailures} issues.`);
  process.exit(1);
} else {
  console.log(`\n✅ All 11 email previews generated and passed strict visual audits (0 issues).\n`);
}
