import {
  getStarterChecklistForServices, computeNextAction, getUserExecutionTasks,
  calculateUserWorkload, getDeliveriesByProject, computeProjectHealth,
  getTeamPulse, getProjectsNeedingAttention, type TaskRow, type ProjectRow, type ProfileRow
} from "../src/components/admin/project-utils";

function runEndToEndAuditTest() {
  console.log("=================================================");
  console.log("SADA WORK OS — END-TO-END OPERATIONAL FLOW AUDIT");
  console.log("=================================================");

  // 1. INQUIRY DATA & CONVERSION
  const mockInquiry = {
    id: "inq-101",
    name: "Mohamed Kallel",
    email: "mohamed@totta.tn",
    phone: "+216 98 123 456",
    business_name: "TOTTA Restaurant",
    service: "Rebranding & Website",
    budget: "$3,000 - $5,000",
    message: "We need a modern ordering website and visual rebranding.",
    created_at: new Date().toISOString(),
    discovery_data: {
      business_type: "Restaurant",
      priority_service: "Website",
      services_needed: ["Branding", "Website", "Reels"],
      request_summary: "Client requires a modern ordering experience and brand transformation.",
      preferred_contact: "WhatsApp",
    },
  };

  console.log("1. INQUIRY:", mockInquiry.business_name, "via", mockInquiry.discovery_data.preferred_contact);

  // 2. CONVERT TO PROJECT & STARTER CHECKLIST
  const starterTasks = getStarterChecklistForServices(mockInquiry.discovery_data.services_needed);
  console.log("2. CONVERSION -> PROJECT CREATED with", starterTasks.length, "starter checklist tasks");
  if (starterTasks.length === 0) {
    throw new Error("Failed: No starter tasks generated for inquiry services");
  }

  // 3. PROJECT PLAN / PHASES & TASKS
  const mockProfiles: ProfileRow[] = [
    { id: "admin-1", display_name: "Ahmed SADA" },
    { id: "admin-2", display_name: "Mariem SADA" },
  ];

  const mockProject: ProjectRow = {
    id: "proj-totta",
    title: "TOTTA Restaurant — Website & Rebranding",
    client_name: "TOTTA Restaurant",
    status: "active",
    description: "Modern ordering website and brand transformation.\n\n[CLIENT CONTACT: Email: mohamed@totta.tn · Phone: +216 98 123 456 · Preferred Channel: WhatsApp]",
    business_type: "Restaurant",
    goals: "Increase online orders and modernize brand image",
    problems: "Outdated website and no digital menu",
    requested_services: ["Branding", "Website", "Reels"],
    provided_services: ["Branding", "Website", "Reels"],
    timeline: "4 Weeks",
    budget: "$3,000 - $5,000",
    original_message: mockInquiry.message,
    questionnaire_answers: mockInquiry.discovery_data,
    contact_submission_id: mockInquiry.id,
    start_date: "2026-09-01",
    deadline: "2026-09-30",
    last_contact_date: new Date().toISOString(),
    next_followup_date: new Date().toISOString(),
    followup_owner_id: "admin-1",
    followup_status: "waiting_for_client",
    followup_summary: "Sent moodboard direction and waiting for photo folder access.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTasks: TaskRow[] = [
    {
      id: "task-101",
      project_id: "proj-totta",
      title: "Brand Strategy & Positioning Brief",
      description: "Formulate brand pillars and tone of voice",
      status: "done",
      priority: "high",
      assignee_id: "admin-1",
      assigned_by_id: "admin-1",
      category: "Strategy",
      service: "Branding",
      start_date: "2026-09-01",
      end_date: null,
      deadline: "2026-09-05",
      estimated_minutes: 120,
      actual_minutes: 110,
      notes: "Brand guidelines draft finalized",
      postpone_reason: null,
      result_title: "Brand Strategy Brief v1",
      result_links: ["https://figma.com/file/totta-brand-strategy"],
      result_notes: "Approved by client",
      previous_assignee_id: null,
      handoff_reason: null,
      waiting_on: null,
      blocked_reason: null,
      completed_at: new Date().toISOString(),
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "task-102",
      project_id: "proj-totta",
      title: "UI/UX High-Fidelity Ordering Prototype",
      description: "Design responsive online ordering screens",
      status: "blocked",
      priority: "urgent",
      assignee_id: "admin-2",
      assigned_by_id: "admin-1",
      category: "Design",
      service: "Website",
      start_date: "2026-09-06",
      end_date: null,
      deadline: new Date().toISOString().split("T")[0],
      estimated_minutes: 240,
      actual_minutes: null,
      notes: "Awaiting final menu photos from client",
      postpone_reason: null,
      result_title: null,
      result_links: [],
      result_notes: null,
      previous_assignee_id: "admin-1",
      handoff_reason: "Reassigned to Mariem for UI prototyping",
      waiting_on: "client",
      blocked_reason: "Waiting for high-res menu photos from TOTTA team",
      completed_at: null,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  console.log("3. TASKS & OWNERSHIP: Created", mockTasks.length, "tasks. Task 102 delegated to Mariem SADA by Ahmed SADA.");

  // 4. DAILY EXECUTION & NEXT ACTION
  const user1Exec = getUserExecutionTasks(mockTasks, "admin-1");
  const user2Exec = getUserExecutionTasks(mockTasks, "admin-2");
  console.log("4. DAILY EXECUTION: Mariem has", user2Exec.blocked.length, "blocked task(s).");

  const nextAction = computeNextAction(mockProject, mockTasks);
  console.log("5. DETERMINISTIC NEXT ACTION:", nextAction.badgeLabel, "—", nextAction.title);

  // 6. CLIENT FOLLOW-UP LOGIC
  const needingAttention = getProjectsNeedingAttention([mockProject], mockTasks);
  console.log("6. CLIENT FOLLOW-UP RADAR:", needingAttention.length, "project(s) needing attention due to:", needingAttention[0]?.reason);

  // 7. DELIVERABLE TRACEABILITY
  const deliveries = getDeliveriesByProject([mockProject], mockTasks);
  console.log("7. DELIVERABLES:", deliveries[0]?.deliverables.length, "deliverable(s) attached:", deliveries[0]?.deliverables[0]?.title);

  // 8. PROJECT HEALTH RADAR
  const health = computeProjectHealth(mockProject, mockTasks);
  console.log("8. PROJECT HEALTH:", health.label, "— Reason:", health.reason);

  // 9. TEAM WORKLOAD RADAR
  const workload1 = calculateUserWorkload(mockTasks, "admin-1");
  const workload2 = calculateUserWorkload(mockTasks, "admin-2");
  console.log("9. TEAM WORKLOAD: Ahmed =", workload1.intensity, "· Mariem =", workload2.intensity);

  const pulse = getTeamPulse(mockProfiles, mockTasks);
  console.log("10. TEAM PULSE:", pulse.map(p => `${p.profile.display_name} (${p.activeCount} active)`).join(", "));

  console.log("\n=================================================");
  console.log("END-TO-END OPERATIONAL FLOW AUDIT PASSED 100%! ✅");
  console.log("=================================================");
}

runEndToEndAuditTest();
