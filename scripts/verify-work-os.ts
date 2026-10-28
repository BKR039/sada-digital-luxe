import {
  computeProgress,
  computeProjectHealth,
  getProjectPeriodStats,
  getPeriodRange,
  isProjectInPeriod,
  type TaskRow,
  type ProjectRow
} from "../src/components/admin/project-utils";

async function runVerification() {
  console.log("=== SADA WORK OS — OPERATIONAL SCENARIOS VERIFICATION ===");

  // 1. Test Deterministic Health Engine
  console.log("\n1. Testing Project Health Engine...");
  const mockProject: ProjectRow = {
    id: "test-proj-1",
    title: "Caffè 707 Social Media & Content",
    client_name: "Caffè 707",
    status: "active",
    description: "Reels and brand content",
    business_type: "Restaurant",
    goals: "Increase footfall",
    problems: "Low reach",
    requested_services: ["Content", "Reels", "Social Media"],
    provided_services: ["Content", "Reels", "Social Media"],
    timeline: "This month",
    budget: "$2,500 - $5,000",
    original_message: null,
    questionnaire_answers: null,
    contact_submission_id: null,
    start_date: "2026-09-01",
    deadline: "2026-09-30",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-14T10:00:00Z",
  };

  const mockTasksHealthy: TaskRow[] = [
    {
      id: "t1", project_id: "test-proj-1", title: "Content Shooting", description: null,
      status: "done", priority: "high", assignee_id: null, category: "Production", service: "Reels",
      start_date: "2026-09-05T10:00:00Z", end_date: null, deadline: "2026-09-06",
      estimated_minutes: 180, actual_minutes: 150, notes: null, postpone_reason: null,
      result_title: "Raw 4K Footage", result_links: ["https://drive.google.com/test-footage"], result_notes: "Shot on location",
      previous_assignee_id: null, handoff_reason: null, waiting_on: null, blocked_reason: null, completed_at: "2026-09-06T15:00:00Z",
      sort_order: 0, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-06T15:00:00Z"
    },
    {
      id: "t2", project_id: "test-proj-1", title: "Edit Reel #01", description: null,
      status: "done", priority: "high", assignee_id: null, category: "Production", service: "Reels",
      start_date: "2026-09-07T10:00:00Z", end_date: null, deadline: "2026-09-08",
      estimated_minutes: 120, actual_minutes: 110, notes: null, postpone_reason: null,
      result_title: "Final Reel #01", result_links: ["https://instagram.com/reel/test1"], result_notes: "Approved by client",
      previous_assignee_id: null, handoff_reason: null, waiting_on: null, blocked_reason: null, completed_at: "2026-09-08T16:00:00Z",
      sort_order: 1, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-08T16:00:00Z"
    },
    {
      id: "t3", project_id: "test-proj-1", title: "Edit Reel #02", description: null,
      status: "in_progress", priority: "high", assignee_id: null, category: "Production", service: "Reels",
      start_date: "2026-09-14T10:00:00Z", end_date: null, deadline: "2026-09-25",
      estimated_minutes: 120, actual_minutes: null, notes: null, postpone_reason: null,
      result_title: null, result_links: [], result_notes: null,
      previous_assignee_id: null, handoff_reason: null, waiting_on: null, blocked_reason: null, completed_at: null,
      sort_order: 2, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-14T10:00:00Z"
    }
  ];

  const healthy = computeProjectHealth(mockProject, mockTasksHealthy);
  console.log(`Healthy State: ${healthy.health} [${healthy.label}] — ${healthy.reason}`);
  if (healthy.health !== "on_track") throw new Error("Expected on_track");

  // Test At Risk with blocked task
  const mockTasksBlocked: TaskRow[] = [
    ...mockTasksHealthy,
    {
      id: "t4", project_id: "test-proj-1", title: "Client Review & Sign-off", description: null,
      status: "blocked", priority: "urgent", assignee_id: null, category: "Review", service: "Social Media",
      start_date: "2026-09-14T10:00:00Z", end_date: null, deadline: "2026-09-15",
      estimated_minutes: 60, actual_minutes: null, notes: null, postpone_reason: null,
      result_title: null, result_links: [], result_notes: null,
      previous_assignee_id: null, handoff_reason: null, waiting_on: "client", blocked_reason: "Waiting on client approval for soundtrack",
      completed_at: null, sort_order: 3, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-14T10:00:00Z"
    }
  ];

  const atRisk = computeProjectHealth(mockProject, mockTasksBlocked);
  console.log(`At Risk State: ${atRisk.health} [${atRisk.label}] — ${atRisk.reason}`);
  if (atRisk.health !== "at_risk") throw new Error("Expected at_risk for blocked task");

  // Test Overdue Project
  const mockProjectOverdue: ProjectRow = {
    ...mockProject,
    deadline: "2026-09-10", // past date
  };
  const overdue = computeProjectHealth(mockProjectOverdue, mockTasksHealthy);
  console.log(`Overdue State: ${overdue.health} [${overdue.label}] — ${overdue.reason}`);
  if (overdue.health !== "overdue") throw new Error("Expected overdue for past deadline");

  // 2. Test Period Range & Overlap Filter
  console.log("\n2. Testing Period Filter Engine...");
  const anchor = new Date("2026-09-14T12:00:00Z");
  const monthRange = getPeriodRange("this_month", anchor);
  console.log(`This Month Range: ${monthRange.label} (${monthRange.start.toISOString()} to ${monthRange.end.toISOString()})`);

  const inPeriod = isProjectInPeriod(mockProject, "this_month", monthRange.start, monthRange.end);
  console.log(`Is September project in This Month? ${inPeriod}`);
  if (!inPeriod) throw new Error("Expected project to be in This Month");

  // 3. Test Progress Calculator with new review and blocked statuses
  console.log("\n3. Testing Progress Calculation with Work OS statuses...");
  const progress = computeProgress(mockTasksBlocked);
  console.log(`Progress: ${progress.percent}% done (${progress.done}/${progress.total}), ${progress.inProgress} in progress, ${progress.blocked} blocked`);
  if (progress.percent !== 50 || progress.blocked !== 1) throw new Error("Progress computation mismatch");

  // 4. Test Period Stats Calculator
  console.log("\n4. Testing Period Stats...");
  const periodStats = getProjectPeriodStats(mockProject);
  console.log(`Period Stats: ${periodStats.label} (Days remaining: ${periodStats.daysRemaining}, Overdue: ${periodStats.isOverdue})`);

  console.log("\n=== ALL OPERATIONAL SCENARIOS PASSED WITH ZERO ERRORS ===");
}

runVerification().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
