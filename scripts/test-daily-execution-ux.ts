import {
  getUserExecutionTasks, calculateUserWorkload, getDeliveriesByProject,
  getTeamPulse, getProjectsNeedingAttention, computeNextAction,
  type TaskRow, type ProjectRow, type ProfileRow
} from "../src/components/admin/project-utils";

function runVerification() {
  console.log("==========================================");
  console.log("SADA WORK OS — DAILY EXECUTION UX TEST");
  console.log("==========================================");

  const mockProfiles: ProfileRow[] = [
    { id: "user-1", display_name: "Ahmed SADA" },
    { id: "user-2", display_name: "Mariem SADA" },
  ];

  const mockProjects: ProjectRow[] = [
    {
      id: "proj-1",
      title: "Rebranding & Website",
      client_name: "TOTTA",
      status: "active",
      description: "Full brand transformation",
      business_type: "Restaurant",
      goals: "Drive online orders",
      problems: null,
      requested_services: ["Branding", "Website"],
      start_date: "2026-09-01",
      deadline: "2026-09-30",
      followup_status: "waiting_for_client",
      followup_summary: "Waiting for menu photos",
      questionnaire_answers: {},
      contact_submission_id: null,
      timeline: null,
      budget: null,
      original_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "proj-2",
      title: "Social Media Ads",
      client_name: "Caffè 707",
      status: "active",
      description: "Reels & Meta Ads",
      business_type: "Coffee Shop",
      goals: "Local foot traffic",
      problems: null,
      requested_services: ["Reels", "Meta Ads"],
      start_date: "2026-09-05",
      deadline: "2026-09-25",
      followup_status: "followup_due",
      next_followup_date: new Date().toISOString(),
      questionnaire_answers: {},
      contact_submission_id: null,
      timeline: null,
      budget: null,
      original_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockTasks: TaskRow[] = [
    {
      id: "task-1",
      project_id: "proj-1",
      title: "Logo Vector Exports",
      description: "Export SVG and PNG files",
      status: "blocked",
      priority: "high",
      assignee_id: "user-1",
      category: "Design",
      service: "Branding",
      start_date: null,
      end_date: null,
      deadline: "2026-09-18",
      estimated_minutes: 60,
      actual_minutes: null,
      notes: null,
      postpone_reason: null,
      result_title: "Logo Pack v1",
      result_links: ["https://figma.com/file/sample"],
      result_notes: null,
      previous_assignee_id: null,
      handoff_reason: null,
      waiting_on: "client",
      blocked_reason: "Waiting for client color approval",
      completed_at: null,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "task-2",
      project_id: "proj-2",
      title: "Edit Reel #03",
      description: "Color grading & sound design",
      status: "in_progress",
      priority: "urgent",
      assignee_id: "user-1",
      category: "Production",
      service: "Reels",
      start_date: null,
      end_date: null,
      deadline: new Date().toISOString().split("T")[0],
      estimated_minutes: 120,
      actual_minutes: null,
      notes: null,
      postpone_reason: null,
      result_title: null,
      result_links: [],
      result_notes: null,
      previous_assignee_id: null,
      handoff_reason: null,
      waiting_on: null,
      blocked_reason: null,
      completed_at: null,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // 1. User execution tasks
  const userExec = getUserExecutionTasks(mockTasks, "user-1");
  console.log("✓ getUserExecutionTasks:", {
    dueToday: userExec.dueToday.length,
    blocked: userExec.blocked.length,
    inProgress: userExec.inProgress.length,
  });
  if (userExec.dueToday.length !== 1 || userExec.blocked.length !== 1) {
    throw new Error("getUserExecutionTasks failed test");
  }

  // 2. User workload
  const workload = calculateUserWorkload(mockTasks, "user-1");
  console.log("✓ calculateUserWorkload:", workload.intensity, `(${workload.activeCount} active tasks)`);
  if (workload.activeCount !== 2) {
    throw new Error("calculateUserWorkload failed test");
  }

  // 3. Deliveries
  const deliveries = getDeliveriesByProject(mockProjects, mockTasks);
  console.log("✓ getDeliveriesByProject:", deliveries.length, "projects with deliverables");
  if (deliveries.length !== 1) {
    throw new Error("getDeliveriesByProject failed test");
  }

  // 4. Team Pulse
  const pulse = getTeamPulse(mockProfiles, mockTasks);
  console.log("✓ getTeamPulse:", pulse.map(p => `${p.profile.display_name}: ${p.activeCount} active`));
  if (pulse.length !== 1 || pulse[0].activeCount !== 2) {
    throw new Error("getTeamPulse failed test");
  }

  // 5. Projects Needing Attention
  const attention = getProjectsNeedingAttention(mockProjects, mockTasks);
  console.log("✓ getProjectsNeedingAttention:", attention.map(a => `${a.project.client_name} (${a.reason})`));
  if (attention.length !== 2) {
    throw new Error("getProjectsNeedingAttention failed test");
  }

  // 6. Next Action
  const nextAction = computeNextAction(mockProjects[1], [mockTasks[1]]);
  console.log("✓ computeNextAction:", nextAction.badgeLabel, "-", nextAction.title);
  if (!nextAction || nextAction.badgeLabel !== "DUE TODAY") {
    throw new Error("computeNextAction failed test");
  }

  console.log("\nALL DAILY EXECUTION UX TESTS PASSED SUCCESSFULLY! ✅");
}

runVerification();
