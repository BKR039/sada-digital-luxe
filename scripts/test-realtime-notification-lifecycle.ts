// ============================================================
// VERIFICATION SCRIPT: SUPABASE REALTIME NOTIFICATION LIFECYCLE
// Tests multi-subscriber ref-counting, StrictMode tolerance,
// channel reuse, auth guards, and cleanup.
// ============================================================

import fs from "fs";
import path from "path";

// Load .env into process.env before importing Supabase client
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

async function runRealtimeLifecycleTests() {
  console.log("==================================================");
  console.log("STARTING REALTIME NOTIFICATION LIFECYCLE TEST SUITE");
  console.log("==================================================");

  // Dynamic import after env vars are populated
  const {
    subscribeToRealtimeNotifications,
    getActiveNotificationRealtimeSession,
  } = await import("../src/lib/notification-service");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // TEST 1: Auth Guards (null, undefined, empty, 'anon')
  console.log("\n--- TEST 1: Auth Guards ---");
  const unsubNull = subscribeToRealtimeNotifications(null, () => {});
  const unsubUndefined = subscribeToRealtimeNotifications(undefined, () => {});
  const unsubEmpty = subscribeToRealtimeNotifications("  ", () => {});
  const unsubAnon = subscribeToRealtimeNotifications("anon", () => {});

  assert(typeof unsubNull === "function", "unsubNull returns callable cleanup function");
  assert(typeof unsubUndefined === "function", "unsubUndefined returns callable cleanup function");
  assert(typeof unsubEmpty === "function", "unsubEmpty returns callable cleanup function");
  assert(typeof unsubAnon === "function", "unsubAnon returns callable cleanup function");

  assert(getActiveNotificationRealtimeSession("anon") === null, "No session created for 'anon'");
  assert(getActiveNotificationRealtimeSession("") === null, "No session created for empty string");

  unsubNull();
  unsubUndefined();
  unsubEmpty();
  unsubAnon();

  // TEST 2: Single Subscriber Initialization
  console.log("\n--- TEST 2: Single Subscriber Channel Initialization ---");
  const testUserId = "test-user-uuid-12345";
  const receivedEvents1: any[] = [];
  const unsub1 = subscribeToRealtimeNotifications(testUserId, (event) => {
    receivedEvents1.push(event);
  });

  const sessionAfterSub1 = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterSub1 !== null, "Session created for valid authenticated userId");
  assert(sessionAfterSub1?.subscriberCount === 1, "Subscriber count is 1 after first mount");
  assert(sessionAfterSub1?.hasChannel === true, "RealtimeChannel is instantiated");

  // TEST 3: Concurrent Multi-Component Subscription (Mobile Header + Desktop Sidebar)
  console.log("\n--- TEST 3: Concurrent Multi-Component Subscription ---");
  let sub2Error: any = null;
  let unsub2: () => void = () => {};
  const receivedEvents2: any[] = [];

  try {
    // This previously threw: "Error: cannot add 'postgres_changes' callbacks ... after subscribe()"
    unsub2 = subscribeToRealtimeNotifications(testUserId, (event) => {
      receivedEvents2.push(event);
    });
  } catch (err) {
    sub2Error = err;
  }

  assert(sub2Error === null, "Second concurrent subscriber attaches without throwing any error");
  const sessionAfterSub2 = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterSub2?.subscriberCount === 2, "Subscriber count increments to 2 for shared session");
  assert(sessionAfterSub2?.hasChannel === true, "Shared channel remains active");

  // TEST 4: Partial Unmount (e.g. mobile drawer closes while desktop remains mounted)
  console.log("\n--- TEST 4: Partial Unmount ---");
  unsub1();
  const sessionAfterUnsub1 = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterUnsub1?.subscriberCount === 1, "Subscriber count decrements to 1 on partial unmount");
  assert(sessionAfterUnsub1?.status !== "teardown_pending", "Session is NOT pending teardown while 1 subscriber remains");

  // TEST 5: StrictMode Simulation (mount -> unmount -> remount within grace window)
  console.log("\n--- TEST 5: React StrictMode Grace Period Simulation ---");
  unsub2(); // count becomes 0
  const sessionAfterUnsub2 = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterUnsub2?.subscriberCount === 0, "Subscriber count becomes 0");
  assert(sessionAfterUnsub2?.status === "teardown_pending", "Session entered teardown_pending state");

  // Immediate remount within 50ms (well within the 150ms grace window)
  await sleep(50);
  const receivedEvents3: any[] = [];
  const unsub3 = subscribeToRealtimeNotifications(testUserId, (event) => {
    receivedEvents3.push(event);
  });

  const sessionAfterRemount = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterRemount?.subscriberCount === 1, "Remounted subscriber successfully attached");
  assert(sessionAfterRemount?.status !== "teardown_pending", "Teardown timer was cancelled on remount");
  assert(sessionAfterRemount?.hasChannel === true, "Channel was preserved across StrictMode remount without recreation");

  // TEST 6: Complete Teardown & Channel Removal
  console.log("\n--- TEST 6: Complete Teardown & Channel Removal After Grace Period ---");
  unsub3(); // All subscribers now disconnected
  assert(getActiveNotificationRealtimeSession(testUserId)?.status === "teardown_pending", "Session is pending teardown");

  // Wait 250ms for the 150ms grace period to expire
  await sleep(250);
  const sessionAfterGracePeriod = getActiveNotificationRealtimeSession(testUserId);
  assert(sessionAfterGracePeriod === null, "Session and channel cleanly removed from memory after grace period");

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRealtimeLifecycleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
