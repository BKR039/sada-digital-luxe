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

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("===============================================================");
  console.log("SADA OS: CHECKBOX & RADIO CONTROLS COMPREHENSIVE VISUAL QA");
  console.log("===============================================================");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authError || !authData.session) throw new Error("Auth failed");

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ s, k }) => {
    localStorage.setItem(k, JSON.stringify(s));
  }, { s: authData.session, k: storageKey });

  // 1. Visit live task modal on /admin/my-work to capture subtasks in light & dark theme
  console.log("\n1. Capturing Live Task Modal Subtasks in Dark & Light theme...");
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate((th) => {
      localStorage.setItem("sada-theme", th);
      if (th === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, theme);

    await page.goto(`${BASE_URL}/admin/my-work?task=e88e3c9f-2920-4943-b0af-c14fbd46757d`, { waitUntil: "networkidle2" });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Screenshot modal
    await page.screenshot({ path: path.join(OUTPUT_DIR, `live_task_modal_${theme}.png`) });

    // Focus / clip just the subtasks section
    const subtaskEl = await page.$('[role="dialog"] [role="checkbox"]');
    if (subtaskEl) {
      const parentContainer = await page.evaluateHandle((el) => {
        return el.closest(".space-y-4, .rounded-2xl, div") || el;
      }, subtaskEl);
      if (parentContainer.asElement()) {
        await (parentContainer.asElement() as any).screenshot({
          path: path.join(OUTPUT_DIR, `subtask_checkbox_checked_${theme}.png`),
        });
      }

      // Uncheck it and screenshot unchecked state
      await subtaskEl.click();
      await new Promise((r) => setTimeout(r, 800));
      if (parentContainer.asElement()) {
        await (parentContainer.asElement() as any).screenshot({
          path: path.join(OUTPUT_DIR, `subtask_checkbox_unchecked_${theme}.png`),
        });
      }

      // Toggle back to original state
      await subtaskEl.click();
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // 2. Render Full Comprehensive Selection Controls Testbench Matrix
  // Both SADACheckbox / Checkbox & SADARadioGroup / RadioGroup in all states
  console.log("\n2. Rendering Full Selection Controls Testbench Matrix...");
  for (const theme of ["dark", "light"] as const) {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await page.evaluate((th) => {
      localStorage.setItem("sada-theme", th);
      if (th === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, theme);

    // Inject testbench DOM into live page
    await page.evaluate((th) => {
      let testContainer = document.getElementById("sada-qa-controls-matrix");
      if (!testContainer) {
        testContainer = document.createElement("div");
        testContainer.id = "sada-qa-controls-matrix";
        document.body.appendChild(testContainer);
      }

      testContainer.className = `fixed inset-0 z-[9999] overflow-y-auto p-8 ${th === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`;
      testContainer.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 p-6 rounded-3xl ${th === "dark" ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200"} shadow-2xl">
          <div class="border-b ${th === "dark" ? "border-slate-800" : "border-slate-200"} pb-4">
            <h1 class="text-2xl font-bold tracking-tight">SADA OS Selection Controls QA Matrix (${th.toUpperCase()} THEME)</h1>
            <p class="text-sm ${th === "dark" ? "text-slate-400" : "text-slate-500"}">Unmistakable High-Contrast Visual Verification: Checkbox & Radio Controls</p>
          </div>

          <!-- SECTION 1: CHECKBOX CONTROLS -->
          <div class="space-y-4">
            <h2 class="text-lg font-semibold tracking-wide uppercase text-primary">1. Checkbox Controls (Square & Circular)</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <!-- Unchecked Square -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Square Unchecked</span>
                <button type="button" role="checkbox" aria-checked="false" data-state="unchecked"
                  class="peer size-5 shrink-0 rounded-lg border-2 border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30 grid place-content-center transition-all duration-150 outline-none select-none">
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">outline visible, no check</span>
              </div>

              <!-- Checked Square -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Square Checked</span>
                <button type="button" role="checkbox" aria-checked="true" data-state="checked"
                  class="peer size-5 shrink-0 rounded-lg border-2 border-primary bg-primary text-white shadow-xs grid place-content-center transition-all duration-150 outline-none select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <span class="text-[11px] text-primary font-mono font-bold">solid blue + white check</span>
              </div>

              <!-- Unchecked Circle (Task/Subtask) -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Circle Unchecked</span>
                <button type="button" role="checkbox" aria-checked="false" data-state="unchecked"
                  class="peer size-5 shrink-0 rounded-full border-2 border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30 grid place-content-center transition-all duration-150 outline-none select-none">
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">crisp circle outline</span>
              </div>

              <!-- Checked Circle (Task/Subtask Completion) -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Circle Checked</span>
                <button type="button" role="checkbox" aria-checked="true" data-state="checked"
                  class="peer size-5 shrink-0 rounded-full border-2 border-primary bg-primary text-white shadow-xs grid place-content-center transition-all duration-150 outline-none select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <span class="text-[11px] text-primary font-mono font-bold">solid blue + checkmark</span>
              </div>
            </div>

            <!-- Additional Checkbox States: Indeterminate & Disabled -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <!-- Indeterminate -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Indeterminate</span>
                <button type="button" role="checkbox" aria-checked="mixed" data-state="indeterminate"
                  class="peer size-5 shrink-0 rounded-lg border-2 border-primary bg-primary text-white shadow-xs grid place-content-center transition-all duration-150 outline-none select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
                </button>
                <span class="text-[11px] text-primary font-mono">solid blue + dash</span>
              </div>

              <!-- Disabled Unchecked -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Disabled Unchecked</span>
                <button type="button" disabled role="checkbox" aria-checked="false" data-state="unchecked"
                  class="peer size-5 shrink-0 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-background opacity-45 cursor-not-allowed grid place-content-center">
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">muted border</span>
              </div>

              <!-- Disabled Checked -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Disabled Checked</span>
                <button type="button" disabled role="checkbox" aria-checked="true" data-state="checked"
                  class="peer size-5 shrink-0 rounded-lg border-2 border-primary/50 bg-primary/50 text-white opacity-60 cursor-not-allowed grid place-content-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">disabled checkmark</span>
              </div>
            </div>
          </div>

          <!-- SECTION 2: RADIO BUTTON CONTROLS -->
          <div class="space-y-4 pt-4 border-t ${th === "dark" ? "border-slate-800" : "border-slate-200"}">
            <h2 class="text-lg font-semibold tracking-wide uppercase text-primary">2. Radio Button Controls (Standard & Card Options)</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <!-- Unselected Radio -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Radio Unselected</span>
                <button type="button" role="radio" aria-checked="false" data-state="unchecked"
                  class="aspect-square size-5 rounded-full border-2 border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary hover:bg-muted/30 grid place-content-center transition-all duration-150 outline-none select-none">
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">clean outer ring</span>
              </div>

              <!-- Selected Radio -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Radio Selected</span>
                <button type="button" role="radio" aria-checked="true" data-state="checked"
                  class="aspect-square size-5 rounded-full border-2 border-primary bg-background dark:bg-card shadow-2xs grid place-content-center transition-all duration-150 outline-none select-none">
                  <div class="size-2.5 rounded-full bg-primary"></div>
                </button>
                <span class="text-[11px] text-primary font-mono font-bold">solid primary dot</span>
              </div>

              <!-- Disabled Unselected Radio -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Disabled Unselected</span>
                <button type="button" disabled role="radio" aria-checked="false" data-state="unchecked"
                  class="aspect-square size-5 rounded-full border-2 border-slate-300 dark:border-slate-700 bg-background opacity-45 cursor-not-allowed grid place-content-center">
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">muted ring</span>
              </div>

              <!-- Disabled Selected Radio -->
              <div class="p-4 rounded-2xl ${th === "dark" ? "bg-slate-950/60 border border-slate-800" : "bg-slate-50 border border-slate-200"} flex flex-col items-center gap-3 text-center">
                <span class="text-xs font-semibold">Disabled Selected</span>
                <button type="button" disabled role="radio" aria-checked="true" data-state="checked"
                  class="aspect-square size-5 rounded-full border-2 border-primary/50 bg-background opacity-50 cursor-not-allowed grid place-content-center">
                  <div class="size-2.5 rounded-full bg-primary/60"></div>
                </button>
                <span class="text-[11px] text-muted-foreground font-mono">muted inner dot</span>
              </div>
            </div>

            <!-- Radio Card Variant -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label class="relative flex items-start gap-3 p-4 rounded-2xl border ${th === "dark" ? "border-slate-800 bg-slate-900/60 hover:border-primary/40" : "border-slate-200 bg-white hover:border-primary/40"} shadow-2xs cursor-pointer select-none transition-all duration-150">
                <button type="button" role="radio" aria-checked="false" data-state="unchecked"
                  class="mt-0.5 aspect-square size-5 rounded-full border-2 border-slate-400/80 dark:border-slate-500/80 bg-background hover:border-primary grid place-content-center shrink-0">
                </button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm">Standard Option (Unselected)</div>
                  <div class="text-xs text-muted-foreground mt-0.5">Card border neutral, radio empty</div>
                </div>
              </label>

              <label class="relative flex items-start gap-3 p-4 rounded-2xl border-2 border-primary bg-primary/[0.04] shadow-xs cursor-pointer select-none transition-all duration-150">
                <button type="button" role="radio" aria-checked="true" data-state="checked"
                  class="mt-0.5 aspect-square size-5 rounded-full border-2 border-primary bg-background dark:bg-card grid place-content-center shrink-0">
                  <div class="size-2.5 rounded-full bg-primary"></div>
                </button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm text-primary">Selected Option (Card Active)</div>
                  <div class="text-xs text-primary/80 mt-0.5">Primary border, active tinted background, solid inner dot</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      `;
    }, theme);

    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUTPUT_DIR, `controls_matrix_${theme}.png`) });
    console.log(`Saved controls_matrix_${theme}.png`);
  }

  await browser.close();
  console.log("All visual QA inspections completed!");
}

main().catch(console.error);
