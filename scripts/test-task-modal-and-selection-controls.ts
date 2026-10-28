import puppeteer, { type Browser, type Page } from "puppeteer-core";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);
const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

const OUTPUT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\bd4dcd1f-b1c8-46b1-87de-b105e235d198\\task_and_controls_qa";

const TASK_A_ID = "e88e3c9f-2920-4943-b0af-c14fbd46757d";
const TASK_B_ID = "4b4c54e0-7cef-491c-b0a6-069e78a41a60";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestReport[] = [];

function assert(name: string, condition: boolean, details: string) {
  testResults.push({ name, passed: condition, details });
  console.log(`${condition ? "✅ PASS" : "❌ FAIL"}: ${name} — ${details}`);
  if (!condition) {
    throw new Error(`Assertion failed: ${name} — ${details}`);
  }
}

async function setupPageAuth(page: Page, session: any, lang = "en", theme = "dark") {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ s, k, l, th }) => {
    localStorage.setItem(k, JSON.stringify(s));
    localStorage.setItem("sada-lang", l);
    localStorage.setItem("sada-theme", th);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    if (th === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, { s: session, k: storageKey, l: lang, th: theme });
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("=== SADA OS: Task Modal & Selection Controls E2E Test Suite ===");

  // 1. Authenticate with SuperAdmin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await setupPageAuth(page, authData.session, "en", "dark");

  // =========================================================================
  // TEST A: Direct deep link opens dialog with correct task
  // =========================================================================
  console.log("\n--- TEST A: Direct Deep Link ---");
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  
  const dialogExistsA = await page.$('[role="dialog"]') !== null;
  const currentUrlA = page.url();
  const titleA = await page.evaluate(() => {
    const el = document.querySelector("#task-detail-title, [role='dialog'] h2, [role='dialog'] h3, [role='dialog'] input");
    return el ? (el.textContent || (el as HTMLInputElement).value || "") : "";
  });

  assert("TEST A - Dialog Open", dialogExistsA, "Task details modal opened via direct deep link");
  assert("TEST A - URL Contains Task", currentUrlA.includes(`task=${TASK_A_ID}`), `URL has task=${TASK_A_ID}`);
  console.log(`Task title: "${titleA}"`);

  await page.screenshot({ path: path.join(OUTPUT_DIR, "test_a_direct_deep_link.png") });

  // =========================================================================
  // TEST B: Close remains closed (Footer Close button, wait 2s, harmless re-render)
  // =========================================================================
  console.log("\n--- TEST B: Close Remains Closed ---");
  // Click footer Close button
  const closeButtonSelector = '[role="dialog"] button';
  const closeClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
    const btn = buttons.find((b) => b.textContent?.trim().toLowerCase() === "close" || b.textContent?.trim() === "إغلاق");
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  assert("TEST B - Click Close Button", closeClicked, "Found and clicked the visible Close button");

  await new Promise((r) => setTimeout(r, 600));

  const dialogAfterClose = await page.$('[role="dialog"]');
  const urlAfterClose = page.url();
  assert("TEST B - Dialog Disappeared", dialogAfterClose === null, "Dialog disappeared immediately after clicking Close");
  assert("TEST B - Task Removed From URL", !urlAfterClose.includes("task="), `URL does not contain task param: ${urlAfterClose}`);

  // Wait 2.5 seconds to prove it does not reopen
  console.log("Waiting 2.5 seconds to confirm dialog remains closed...");
  await new Promise((r) => setTimeout(r, 2500));
  const dialogAfterDelay = await page.$('[role="dialog"]');
  assert("TEST B - Dialog Stays Closed After 2.5s", dialogAfterDelay === null, "Dialog remains closed after 2.5 seconds");

  // Trigger harmless re-render / data refresh
  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
  });
  await new Promise((r) => setTimeout(r, 500));
  const dialogAfterRerender = await page.$('[role="dialog"]');
  assert("TEST B - Dialog Stays Closed After Re-render", dialogAfterRerender === null, "Dialog remains closed after re-render/resize event");

  await page.screenshot({ path: path.join(OUTPUT_DIR, "test_b_closed_remains_closed.png") });

  // =========================================================================
  // TEST C: All Close Mechanisms (Header X, Escape key, Backdrop)
  // =========================================================================
  console.log("\n--- TEST C1: Header X button ---");
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

  const xClicked = await page.evaluate(() => {
    const xBtn = document.querySelector('[role="dialog"] button[aria-label="Close"], [role="dialog"] button[aria-label="إغلاق"]');
    if (xBtn) {
      (xBtn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  assert("TEST C1 - Click Header X", xClicked, "Clicked header X button");
  await new Promise((r) => setTimeout(r, 600));
  const dialogAfterX = await page.$('[role="dialog"]');
  const urlAfterX = page.url();
  assert("TEST C1 - Dialog Closed via X", dialogAfterX === null && !urlAfterX.includes("task="), "Dialog closed and URL cleaned via X button");

  console.log("\n--- TEST C2: Escape key ---");
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));
  const dialogAfterEsc = await page.$('[role="dialog"]');
  const urlAfterEsc = page.url();
  assert("TEST C2 - Dialog Closed via Escape", dialogAfterEsc === null && !urlAfterEsc.includes("task="), "Dialog closed and URL cleaned via Escape key");

  console.log("\n--- TEST C3: Backdrop click ---");
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  // Click at coordinate (10, 10) which is on the backdrop
  await page.mouse.click(10, 10);
  await new Promise((r) => setTimeout(r, 600));
  const dialogAfterBackdrop = await page.$('[role="dialog"]');
  const urlAfterBackdrop = page.url();
  assert("TEST C3 - Dialog Closed via Backdrop", dialogAfterBackdrop === null && !urlAfterBackdrop.includes("task="), "Dialog closed and URL cleaned via Backdrop click");

  // =========================================================================
  // TEST D: Reopen another task (Task A closed, Task B opened)
  // =========================================================================
  console.log("\n--- TEST D: Reopen Another Task ---");
  // Open Task B via deep link
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_B_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  const urlD = page.url();
  assert("TEST D - Task B Opens", urlD.includes(`task=${TASK_B_ID}`), `URL has task B: ${urlD}`);

  // Close Task B
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));
  assert("TEST D - Task B Closes", (await page.$('[role="dialog"]')) === null, "Task B closed cleanly");

  // =========================================================================
  // TEST E: Browser history (Back and Forward)
  // =========================================================================
  console.log("\n--- TEST E: Browser History ---");
  await page.goto(`${BASE_URL}/admin/my-work`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1000));
  // Navigate to task
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  // Hit back
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1000));
  const dialogAfterBack = await page.$('[role="dialog"]');
  const urlAfterBack = page.url();
  assert("TEST E - Back Closes Dialog", dialogAfterBack === null && !urlAfterBack.includes("task="), "Browser Back returns to closed dialog state");

  // Hit forward
  await page.goForward();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  const dialogAfterForward = await page.$('[role="dialog"]');
  assert("TEST E - Forward Re-opens Dialog", dialogAfterForward !== null, "Browser Forward restores open dialog state");

  // Clean close
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));

  // =========================================================================
  // TEST F: Preserve unrelated search parameters
  // =========================================================================
  console.log("\n--- TEST F: Preserve Unrelated Search Parameters ---");
  await page.goto(`${BASE_URL}/admin/my-work?status=open&priority=urgent&task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  // Close the dialog
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));
  const urlF = page.url();
  assert("TEST F - Task Removed Only", !urlF.includes("task=") && urlF.includes("status=open") && urlF.includes("priority=urgent"), `Unrelated params preserved: ${urlF}`);

  // =========================================================================
  // TEST G: Notification deep-link regression (?taskId=<id>)
  // =========================================================================
  console.log("\n--- TEST G: Notification Deep-link (?taskId=...) ---");
  await page.goto(`${BASE_URL}/admin/my-work?taskId=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  assert("TEST G - Notification Deep Link Opens", (await page.$('[role="dialog"]')) !== null, "Task opens via notification taskId param");
  // Close it
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));
  const urlG = page.url();
  assert("TEST G - Notification Param Removed", !urlG.includes("taskId=") && !urlG.includes("task="), `taskId removed on close: ${urlG}`);
  await new Promise((r) => setTimeout(r, 2000));
  assert("TEST G - Remains Closed", (await page.$('[role="dialog"]')) === null, "Dialog remains closed permanently");

  // =========================================================================
  // SELECTION CONTROLS TEST SUITE & VISUAL QA
  // =========================================================================
  console.log("\n--- SELECTION CONTROLS: Subtask & Checkbox Verification ---");
  await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

  // Inspect subtasks section
  const subtaskData = await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('[role="dialog"] [role="checkbox"]'));
    return checkboxes.map((cb) => ({
      state: cb.getAttribute("data-state"),
      classes: cb.className,
      hasCheckIcon: cb.querySelector("svg") !== null,
    }));
  });

  console.log("Subtasks found:", subtaskData.length, subtaskData);
  assert("SELECTION - Subtask Checkboxes Rendered", subtaskData.length > 0, `Found ${subtaskData.length} subtask checkboxes in dialog`);

  // Verify checked vs unchecked visual distinction
  const checkedBox = subtaskData.find((s) => s.state === "checked");
  if (checkedBox) {
    assert("SELECTION - Checked Subtask High Contrast", checkedBox.classes.includes("data-[state=checked]:bg-primary") && checkedBox.hasCheckIcon, "Checked subtask has solid primary bg and checkmark");
  }

  // Toggle subtask in dialog
  const toggleResult = await page.evaluate(() => {
    const cb = document.querySelector('[role="dialog"] [role="checkbox"]') as HTMLButtonElement;
    if (!cb) return null;
    const initial = cb.getAttribute("data-state");
    cb.click();
    return { initial };
  });

  await new Promise((r) => setTimeout(r, 1000));
  const afterToggleState = await page.evaluate(() => {
    const cb = document.querySelector('[role="dialog"] [role="checkbox"]');
    return cb?.getAttribute("data-state");
  });

  console.log(`Subtask toggle: ${toggleResult?.initial} -> ${afterToggleState}`);
  assert("SELECTION - Subtask Toggle Works", toggleResult?.initial !== afterToggleState, `Toggled from ${toggleResult?.initial} to ${afterToggleState}`);

  // Capture subtasks QA screenshot
  await page.screenshot({ path: path.join(OUTPUT_DIR, "subtasks_selection_states.png") });

  // Toggle back to preserve original DB state
  await page.evaluate(() => {
    const cb = document.querySelector('[role="dialog"] [role="checkbox"]') as HTMLButtonElement;
    cb?.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // =========================================================================
  // VIEWPORT MATRIX & THEME QA SCREENSHOTS
  // =========================================================================
  console.log("\n--- VIEWPORT & THEME MATRIX SCREENSHOTS ---");
  const matrix = [
    { name: "desktop_dark_en", width: 1440, height: 900, lang: "en", theme: "dark" },
    { name: "desktop_light_en", width: 1440, height: 900, lang: "en", theme: "light" },
    { name: "desktop_dark_ar", width: 1440, height: 900, lang: "ar", theme: "dark" },
    { name: "mobile_dark_en", width: 390, height: 844, lang: "en", theme: "dark" },
    { name: "mobile_light_ar", width: 390, height: 844, lang: "ar", theme: "light" },
  ];

  for (const m of matrix) {
    console.log(`Capturing: ${m.name}`);
    await page.setViewport({ width: m.width, height: m.height });
    await setupPageAuth(page, authData.session, m.lang, m.theme);
    await page.goto(`${BASE_URL}/admin/my-work?task=${TASK_A_ID}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${m.name}_task_modal.png`) });
  }

  await browser.close();

  console.log("\n=== SUMMARY OF ALL TESTS ===");
  const allPassed = testResults.every((t) => t.passed);
  console.log(`Total tests: ${testResults.length} | Passed: ${testResults.filter((t) => t.passed).length} | Failed: ${testResults.filter((t) => !t.passed).length}`);
  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } else {
    console.log("❌ SOME TESTS FAILED!");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
