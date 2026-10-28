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

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/test_run");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr || !auth.session) {
    console.error("Auth error:", authErr?.message);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    const projectRef = "mtfkzabiscyleztypqks";
    const storageKey = `sb-${projectRef}-auth-token`;

    await page.evaluateOnNewDocument(
      ({ sess, key }) => {
        localStorage.setItem("sada-lang", "en");
        localStorage.setItem("sada_language", "en");
        localStorage.setItem("theme", "light");
        localStorage.setItem("sada-theme", "light");
        if (sess) {
          localStorage.setItem(key, JSON.stringify(sess));
          localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
        }
      },
      { sess: auth.session, key: storageKey }
    );

    // Initial navigation
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });

    const setupAndNavigate = async (vp: { width: number; height: number }, route: string, lang = "en", theme = "light") => {
      await page.setViewport(vp);
      await page.evaluate(
        ({ l, th, sess, key }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada_language", l);
          localStorage.setItem("theme", th);
          localStorage.setItem("sada-theme", th);
          if (sess) {
            localStorage.setItem(key, JSON.stringify(sess));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
          }
          document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = l;
          if (th === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        },
        { l: lang, th: theme, sess: auth.session, key: storageKey }
      );

      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle2", timeout: 35000 });
      await new Promise((r) => setTimeout(r, 2500));
    };

    // 1. Executive Command Center in Light Mode at 390x844
    console.log("Navigating to /admin in light mode (390x844)...");
    await setupAndNavigate({ width: 390, height: 844 }, "/admin", "en", "light");

    // Wait until skeleton is gone or until overview grid renders
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes("Collected Revenue") || text.includes("Overview");
      }, { timeout: 15000 });
      console.log("Overview loaded successfully!");
    } catch {
      console.warn("Timed out waiting for overview text, continuing anyway...");
    }

    const execShotPath = path.join(OUTPUT_DIR, "390x844_admin_executive_light_en.png");
    await page.screenshot({ path: execShotPath });
    console.log(`Saved screenshot: ${execShotPath}`);

    // 2. Task Detail Modal in Light Mode at 390x844
    console.log("Navigating to /admin/my-work?task=78ec8b17-4e00-4480-b081-949e3e967e3b in light mode (390x844)...");
    await setupAndNavigate({ width: 390, height: 844 }, "/admin/my-work?task=78ec8b17-4e00-4480-b081-949e3e967e3b", "en", "light");

    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
      console.log("Task detail modal dialog detected!");
    } catch {
      console.warn("Modal dialog selector not detected, continuing anyway...");
    }

    const taskShotPath = path.join(OUTPUT_DIR, "390x844_task_detail_modal_light_en.png");
    await page.screenshot({ path: taskShotPath });
    console.log(`Saved screenshot: ${taskShotPath}`);

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    await browser.close();
  }
}

run();
