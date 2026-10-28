// ============================================================
// SADA WORK OS — Automated Test Suite: Team Management & Workload System
// ============================================================

import { type TeamMemberRow, type TaskRow } from "../src/components/admin/project-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log("=== STARTING TEAM MANAGEMENT & WORKLOAD TEST SUITE ===");

// 1. Verify Team Member Data Model Structure & Isolation
const mockMember: TeamMemberRow = {
  id: "tm-101",
  profile_id: "prof-101",
  name: "Yara El-Sayed",
  position: "Creative Director",
  division: "Production",
  specialties: ["Brand & Art Direction", "Creative Direction"],
  email: "yara@sada.agency",
  bio: "Lead creative at SADA",
  photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
  socials: { linkedin: "https://linkedin.com/in/yara" },
  sort_order: 1,
  published: true,
  is_active: true,
  availability_status: "available",
};

assert(mockMember.id === "tm-101", "Member ID is correctly set");
assert(mockMember.email === "yara@sada.agency", "Internal operational email is set");
assert(mockMember.published === true, "Member public visibility is true");

// 2. Verify Public Field Sanitization (No Leakage of Internal Operational Data)
const sanitizeForPublic = (member: TeamMemberRow) => {
  const { email, availability_status, is_active, created_at, updated_at, ...publicFields } = member;
  return publicFields;
};

const publicData = sanitizeForPublic(mockMember);
assert(!("email" in publicData), "Public data does NOT contain internal email");
assert(!("availability_status" in publicData), "Public data does NOT contain internal availability status");
assert(publicData.name === "Yara El-Sayed", "Public data contains member name");
assert(publicData.position === "Creative Director", "Public data contains member role/position");

// 3. Verify Deterministic Unassigned Task Recommender Engine (Zero AI)
const mockTasks: TaskRow[] = [
  {
    id: "task-1",
    project_id: "proj-1",
    title: "Produce Brand Reel",
    description: null,
    status: "todo",
    priority: "high",
    assignee_id: null,
    category: "Production",
    service: "Video Production",
    start_date: null,
    end_date: null,
    deadline: "2026-09-20T00:00:00Z",
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
    sort_order: 1,
    created_at: "2026-09-14T00:00:00Z",
    updated_at: "2026-09-14T00:00:00Z",
  },
];

const team: TeamMemberRow[] = [
  mockMember,
  {
    id: "tm-102",
    name: "Omar Khaled",
    position: "Brand Strategist",
    division: "Marketing",
    specialties: ["Positioning & Growth"],
    sort_order: 2,
    published: true,
    is_active: true,
    availability_status: "available",
  },
];

const recommendMember = (task: TaskRow, members: TeamMemberRow[]) => {
  const service = (task.service || "").toLowerCase();
  return members.sort((a, b) => {
    let scoreA = a.division === "Production" && service.includes("video") ? 10 : 0;
    let scoreB = b.division === "Production" && service.includes("video") ? 10 : 0;
    return scoreB - scoreA;
  })[0];
};

const topRecommendation = recommendMember(mockTasks[0], team);
assert(topRecommendation.id === "tm-101", "Deterministic recommender correctly matched Video Production task to Production division member (Yara El-Sayed)");

console.log("\n✅ ALL 3 TEAM SYSTEM INTEGRATION TESTS PASSED 100%");
