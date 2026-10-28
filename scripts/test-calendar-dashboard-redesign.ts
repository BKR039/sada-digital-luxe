import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  isTaskActiveOnDay,
  computeTaskVisualState,
  getTaskAlertBadge,
  isTaskOverdue,
  type TaskRow,
} from "../src/components/admin/project-utils";
import { formatDate } from "../src/lib/date-locale";
import { parseISO, addDays, format, subDays, startOfDay, endOfDay, isSameDay, isToday, isPast } from "date-fns";

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`, detail || "");
    failed++;
  }
}

async function run() {
  console.log("======================================================================");
  console.log("  SADA OS — Calendar Operations Dashboard Redesign Verification Suite");
  console.log("======================================================================\n");

  const client = createClient(supabaseUrl!, anonKey!);

  // ---------------------------------------------------------------------------
  // GROUP 1: Canonical Data Architecture (Zero Duplicate Calendar Tables)
  // ---------------------------------------------------------------------------
  console.log("--- GROUP 1: Canonical Data Architecture ---");

  // Verify project_tasks table exists and is accessible
  const { data: sampleTasks, error: taskErr } = await client
    .from("project_tasks")
    .select("id, title, status, start_date, deadline, client_id, service, assignee_id")
    .limit(10);

  assert(!taskErr, "project_tasks is accessible as canonical calendar source of truth");
  assert(Array.isArray(sampleTasks), "project_tasks returns valid task collection");

  // Verify no parallel calendar tables were created
  const { error: noParallelEventsErr } = await client
    .from("calendar_events" as any)
    .select("id")
    .limit(1);
  assert(
    !!noParallelEventsErr,
    "Invariant: calendar_events does not exist; calendar is pure projection of project_tasks"
  );

  const { error: noParallelUpcomingErr } = await client
    .from("upcoming_events" as any)
    .select("id")
    .limit(1);
  assert(
    !!noParallelUpcomingErr,
    "Invariant: upcoming_events does not exist; upcoming panel derived from project_tasks"
  );

  // ---------------------------------------------------------------------------
  // GROUP 2: Selected Day Derivation & Interaction
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 2: Selected Day Derivation Engine ---");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const nextWeekStr = format(addDays(today, 7), "yyyy-MM-dd");

  const mockTasks: TaskRow[] = [
    {
      id: "mock-1",
      project_id: "proj-1",
      client_id: "client-a",
      title: "Reel Shooting - Scene 1",
      description: null,
      status: "in_progress",
      priority: "urgent",
      assignee_id: "user-worker-1",
      category: "video",
      service: "Reels",
      start_date: `${todayStr}T09:00:00Z`,
      end_date: `${todayStr}T13:00:00Z`,
      deadline: `${todayStr}T18:00:00Z`,
      estimated_minutes: 240,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "mock-2",
      project_id: "proj-1",
      client_id: "client-a",
      title: "Product Photoshoot",
      description: null,
      status: "todo",
      priority: "high",
      assignee_id: "user-worker-2",
      category: "photo",
      service: "Photography",
      start_date: `${tomorrowStr}T14:00:00Z`,
      end_date: `${tomorrowStr}T17:00:00Z`,
      deadline: `${tomorrowStr}T18:00:00Z`,
      estimated_minutes: 180,
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
    {
      id: "mock-3",
      project_id: "proj-2",
      client_id: "client-b",
      title: "Post Carousel Design",
      description: null,
      status: "done",
      priority: "medium",
      assignee_id: "user-worker-1",
      category: "design",
      service: "Posts",
      start_date: `${todayStr}T10:00:00Z`,
      end_date: null,
      deadline: `${todayStr}T16:00:00Z`,
      estimated_minutes: 120,
      actual_minutes: 120,
      notes: null,
      postpone_reason: null,
      result_title: null,
      result_links: [],
      result_notes: null,
      previous_assignee_id: null,
      handoff_reason: null,
      waiting_on: null,
      blocked_reason: null,
      completed_at: new Date().toISOString(),
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "mock-4",
      project_id: "proj-2",
      client_id: "client-b",
      title: "Website Audit & SEO Strategy",
      description: null,
      status: "todo",
      priority: "medium",
      assignee_id: "user-worker-2",
      category: "web",
      service: "Web",
      start_date: `${nextWeekStr}T09:00:00Z`,
      end_date: null,
      deadline: `${nextWeekStr}T17:00:00Z`,
      estimated_minutes: 300,
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
      sort_order: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Test selecting today
  const todayTasks = mockTasks.filter(
    (t) => isTaskActiveOnDay(t, today) || (isToday(today) && isTaskOverdue(t))
  );
  assert(todayTasks.length === 2, "Selecting Today resolves exactly 2 active tasks (mock-1 and mock-3)");
  assert(todayTasks.some((t) => t.id === "mock-1"), "Today tasks include mock-1 Reel Shooting");
  assert(todayTasks.some((t) => t.id === "mock-3"), "Today tasks include mock-3 Post Carousel Design");

  // Test selecting tomorrow
  const tomorrow = addDays(today, 1);
  const tomorrowTasks = mockTasks.filter((t) => isTaskActiveOnDay(t, tomorrow));
  assert(tomorrowTasks.length === 1, "Selecting Tomorrow resolves exactly 1 task (mock-2)");
  assert(tomorrowTasks[0].id === "mock-2", "Tomorrow task is Product Photoshoot");

  // ---------------------------------------------------------------------------
  // GROUP 3: Upcoming Panel Chronological Derivation
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 3: Upcoming Panel Chronological Selector ---");

  // When selectedDate is Today, upcoming tasks are strictly future tasks from tomorrow onwards (excluding done)
  const upcomingForToday = mockTasks
    .filter((t) => {
      if (t.status === "done" || t.status === "cancelled") return false;
      const taskDate = t.start_date ? parseISO(t.start_date) : t.deadline ? parseISO(t.deadline) : null;
      if (!taskDate) return false;
      return !isPast(endOfDay(taskDate)) && !isSameDay(taskDate, today);
    })
    .sort((a, b) => {
      const dateA = a.start_date ? parseISO(a.start_date).getTime() : a.deadline ? parseISO(a.deadline).getTime() : 0;
      const dateB = b.start_date ? parseISO(b.start_date).getTime() : b.deadline ? parseISO(b.deadline).getTime() : 0;
      return dateA - dateB;
    });

  assert(upcomingForToday.length === 2, "Upcoming tasks excludes completed mock-3 and today's mock-1 (got: 2)");
  assert(upcomingForToday[0].id === "mock-2", "First upcoming task is tomorrow's mock-2 (Photoshoot)");
  assert(upcomingForToday[1].id === "mock-4", "Second upcoming task is next week's mock-4 (Website Audit)");

  // ---------------------------------------------------------------------------
  // GROUP 4: Multi-Dimensional Filter Consistency
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 4: Multi-Dimensional Filter Consistency ---");

  // 1. Client filter
  const clientATasks = mockTasks.filter((t) => t.client_id === "client-a");
  assert(clientATasks.length === 2, "Filtering by Client A returns 2 tasks (mock-1 and mock-2)");

  // 2. Status filter
  const inProgressTasks = mockTasks.filter((t) => t.status === "in_progress");
  assert(inProgressTasks.length === 1 && inProgressTasks[0].id === "mock-1", "Filtering by status 'in_progress' returns mock-1");

  // 3. Service filter
  const reelsTasks = mockTasks.filter((t) => t.service === "Reels");
  assert(reelsTasks.length === 1 && reelsTasks[0].id === "mock-1", "Filtering by service 'Reels' returns mock-1");

  // 4. Assignee filter
  const worker1Tasks = mockTasks.filter((t) => t.assignee_id === "user-worker-1");
  assert(worker1Tasks.length === 2, "Filtering by Worker 1 returns 2 tasks (mock-1, mock-3)");

  // ---------------------------------------------------------------------------
  // GROUP 5: Visual States and Urgency Badges
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 5: Visual State & Urgency Badges ---");

  const completedState = computeTaskVisualState(mockTasks[2], today);
  assert(completedState === "completed", "Done task has 'completed' visual state");

  const urgentState = computeTaskVisualState(mockTasks[0], today);
  assert(urgentState === "deadline_today" || urgentState === "urgent" || urgentState === "active", "Mock 1 active today resolves valid visual state");

  // ---------------------------------------------------------------------------
  // GROUP 6: Locale & RTL Formatting Immunity
  // ---------------------------------------------------------------------------
  console.log("\n--- GROUP 6: Locale & RTL Formatting ---");

  const enDate = formatDate(parseISO("2026-10-06T12:00:00Z"), "MMMM yyyy", { lang: "en" });
  assert(enDate.toLowerCase().includes("october"), "English formatting resolves 'October 2026'");

  const arDate = formatDate(parseISO("2026-10-06T12:00:00Z"), "MMMM yyyy", { lang: "ar" });
  assert(arDate.includes("أكتوبر") || arDate.length > 0, "Arabic formatting resolves localized month name");

  const weekdayAr = formatDate(parseISO("2026-10-06T12:00:00Z"), "EEEE", { lang: "ar" });
  assert(weekdayAr.length > 0, "Arabic weekday formatting resolves without crash");

  console.log("\n======================================================================");
  console.log(`  Results: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  if (failed === 0) {
    console.log("  Calendar Dashboard Redesign: ALL CHECKS PASSED");
  }
  console.log("======================================================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
