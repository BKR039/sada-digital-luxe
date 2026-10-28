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
const REFINED_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/refined");

if (!fs.existsSync(REFINED_DIR)) {
  fs.mkdirSync(REFINED_DIR, { recursive: true });
}

async function getSession(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    console.error(`Auth failed for ${email}:`, error?.message);
    return null;
  }
  return data.session;
}

interface OverflowCheckResult {
  route: string;
  viewport: string;
  theme?: string;
  lang?: string;
  scrollWidth: number;
  clientWidth: number;
  hasOverflow: boolean;
  overflowElements: string[];
}

async function checkOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number; hasOverflow: boolean; overflowElements: string[] }> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const clientWidth = window.innerWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    const hasOverflow = scrollWidth > clientWidth;

    const overflowElements: string[] = [];
    if (hasOverflow) {
      const all = document.querySelectorAll("*");
      for (const el of Array.from(all)) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 || rect.left < -1) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
          overflowElements.push(`${tag}${id}${cls} (left=${Math.round(rect.left)}, right=${Math.round(rect.right)}, w=${Math.round(rect.width)})`);
          if (overflowElements.length >= 10) break;
        }
      }
    }

    return { scrollWidth, clientWidth, hasOverflow, overflowElements };
  });
}

async function run() {
  console.log("=== SADA OS Universal Responsive UX Master Test Suite ===");
  const superAdminSession = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  const workerSession = await getSession("qa.worker@sada.agency", "WorkerPassword123!");
  if (!superAdminSession || !workerSession) {
    console.error("Failed to acquire required sessions.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const overflowResults: OverflowCheckResult[] = [];

  const VIEWPORTS = [
    { name: "320x640", width: 320, height: 640 },
    { name: "360x800", width: 360, height: 800 },
    { name: "375x812", width: 375, height: 812 },
    { name: "390x844", width: 390, height: 844 },
    { name: "430x932", width: 430, height: 932 },
    { name: "600x800", width: 600, height: 800 },
    { name: "768x1024", width: 768, height: 1024 },
    { name: "1024x768", width: 1024, height: 768 },
    { name: "1280x800", width: 1280, height: 800 },
    { name: "1440x900", width: 1440, height: 900 },
  ];

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
      { sess: superAdminSession, key: storageKey }
    );

    // Initial navigation
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });

    const setupAuthAndNavigate = async (
      session: any,
      vp: { width: number; height: number; name: string },
      route: string,
      lang = "en",
      theme = "light"
    ) => {
      await page.setViewport(vp);

      await page.evaluate(
        ({ sess, l, th, key }) => {
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
        { sess: session, l: lang, th: theme, key: storageKey }
      );

      const targetUrl = new URL(`${BASE_URL}${route}`);
      if (lang === "ar") {
        targetUrl.searchParams.set("lang", "ar");
      } else {
        targetUrl.searchParams.delete("lang");
      }
      await page.goto(targetUrl.toString(), { waitUntil: "networkidle2", timeout: 35000 });

      // Ensure dark mode class is properly synced
      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.classList.add("dark");
        });
      }

      // Wait for all skeleton base loaders and pulse animations to disappear
      try {
        await page.waitForFunction(
          () => !document.querySelector(".sada-skeleton-base") && !document.querySelector(".animate-pulse"),
          { timeout: 15000 }
        );
      } catch {}

      await new Promise((r) => setTimeout(r, 1200));
    };

    // 1. Viewport Matrix across all 10 viewports on Executive Command Center (/admin)
    console.log("\n--- Executing Viewport Matrix across 10 Viewports ---");
    for (const vp of VIEWPORTS) {
      console.log(`Checking viewport ${vp.name}...`);

      // Test Executive Command Center in Light Mode LTR
      await setupAuthAndNavigate(superAdminSession, vp, "/admin", "en", "light");
      let ofCheck = await checkOverflow(page);
      overflowResults.push({
        route: "/admin",
        viewport: vp.name,
        theme: "light",
        lang: "en",
        ...ofCheck,
      });

      if (["320x640", "360x800", "390x844", "430x932", "768x1024", "1440x900"].includes(vp.name)) {
        const file = path.join(REFINED_DIR, `${vp.name}_admin_executive_light_en.png`);
        await page.screenshot({ path: file });
        console.log(`  Saved screenshot: ${file}`);
      }

      // Also Dark Mode variant for 390x844 and 1440x900
      if (["390x844", "1440x900"].includes(vp.name)) {
        await setupAuthAndNavigate(superAdminSession, vp, "/admin", "en", "dark");
        ofCheck = await checkOverflow(page);
        overflowResults.push({
          route: "/admin",
          viewport: vp.name,
          theme: "dark",
          lang: "en",
          ...ofCheck,
        });
        const file = path.join(REFINED_DIR, `${vp.name}_admin_executive_dark_en.png`);
        await page.screenshot({ path: file });
        console.log(`  Saved screenshot: ${file}`);
      }

      // Test My Work (/admin/my-work)
      await setupAuthAndNavigate(superAdminSession, vp, "/admin/my-work", "en", "light");
      ofCheck = await checkOverflow(page);
      overflowResults.push({
        route: "/admin/my-work",
        viewport: vp.name,
        theme: "light",
        lang: "en",
        ...ofCheck,
      });

      if (["320x640", "390x844", "768x1024"].includes(vp.name)) {
        const file = path.join(REFINED_DIR, `${vp.name}_mywork_light_en.png`);
        await page.screenshot({ path: file });
        console.log(`  Saved screenshot: ${file}`);
      }
    }

    // 2. Arabic RTL Matrix on 360x800 and 390x844
    console.log("\n--- Testing Arabic RTL Matrix ---");
    for (const vp of [
      { name: "360x800", width: 360, height: 800 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      // Arabic RTL Light on /admin
      await setupAuthAndNavigate(superAdminSession, vp, "/admin", "ar", "light");
      let ofCheck = await checkOverflow(page);
      overflowResults.push({ route: "/admin (rtl)", viewport: vp.name, theme: "light", lang: "ar", ...ofCheck });
      let file = path.join(REFINED_DIR, `${vp.name}_admin_executive_light_ar.png`);
      await page.screenshot({ path: file });
      console.log(`  Saved RTL screenshot: ${file}`);

      // Arabic RTL on /admin/my-work
      await setupAuthAndNavigate(superAdminSession, vp, "/admin/my-work", "ar", "light");
      ofCheck = await checkOverflow(page);
      overflowResults.push({ route: "/admin/my-work (rtl)", viewport: vp.name, theme: "light", lang: "ar", ...ofCheck });
      file = path.join(REFINED_DIR, `${vp.name}_mywork_light_ar.png`);
      await page.screenshot({ path: file });
      console.log(`  Saved MyWork RTL screenshot: ${file}`);
    }

    // 3. Task Detail Modal across Viewports & Modes
    console.log("\n--- Testing Task Detail Modal ---");
    for (const vp of [
      { name: "360x800", width: 360, height: 800 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      // English Light Task Detail Modal
      await setupAuthAndNavigate(superAdminSession, vp, "/admin/my-work?task=78ec8b17-4e00-4480-b081-949e3e967e3b", "en", "light");
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove());
      });
      await new Promise((r) => setTimeout(r, 800));

      let ofCheck = await checkOverflow(page);
      overflowResults.push({ route: "TaskDetailModal (light en)", viewport: vp.name, theme: "light", lang: "en", ...ofCheck });
      let file = path.join(REFINED_DIR, `${vp.name}_task_detail_modal_light_en.png`);
      await page.screenshot({ path: file });
      console.log(`  Saved Task Detail Modal screenshot: ${file}`);

      // Arabic RTL Task Detail Modal
      await setupAuthAndNavigate(superAdminSession, vp, "/admin/my-work?task=78ec8b17-4e00-4480-b081-949e3e967e3b", "ar", "light");
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove());
      });
      await new Promise((r) => setTimeout(r, 800));

      ofCheck = await checkOverflow(page);
      overflowResults.push({ route: "TaskDetailModal (light ar)", viewport: vp.name, theme: "light", lang: "ar", ...ofCheck });
      file = path.join(REFINED_DIR, `${vp.name}_task_detail_modal_light_ar.png`);
      await page.screenshot({ path: file });
      console.log(`  Saved Task Detail Modal RTL screenshot: ${file}`);
    }

    // 4. Attention Center Drawer
    console.log("\n--- Testing Attention Management Drawer ---");
    await setupAuthAndNavigate(superAdminSession, { name: "390x844", width: 390, height: 844 }, "/admin", "en", "light");
    await page.evaluate(() => {
      const bellSvg = document.querySelector("header svg.lucide-bell");
      const btn = bellSvg?.closest("button") as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    let ofCheck = await checkOverflow(page);
    overflowResults.push({ route: "AttentionDrawer", viewport: "390x844", theme: "light", lang: "en", ...ofCheck });
    let file = path.join(REFINED_DIR, "390x844_attention_drawer_light_en.png");
    await page.screenshot({ path: file });
    console.log(`  Saved Attention Drawer screenshot: ${file}`);

    // 5. Worker Account Role Verification
    console.log("\n--- Testing Worker Role Experience ---");
    await setupAuthAndNavigate(workerSession, { name: "390x844", width: 390, height: 844 }, "/admin/my-work", "en", "light");
    ofCheck = await checkOverflow(page);
    overflowResults.push({ route: "/admin/my-work (worker role)", viewport: "390x844", theme: "light", lang: "en", ...ofCheck });
    file = path.join(REFINED_DIR, "390x844_worker_mywork_light_en.png");
    await page.screenshot({ path: file });
    console.log(`  Saved Worker Role screenshot: ${file}`);

    // 6. Data-Dense Tables & Additional Core Modules
    console.log("\n--- Testing Data-Dense Modules (/admin/finance, /admin/sales, /admin/packages) ---");
    for (const r of ["/admin/finance", "/admin/sales", "/admin/packages"]) {
      await setupAuthAndNavigate(superAdminSession, { name: "390x844", width: 390, height: 844 }, r, "en", "light");
      ofCheck = await checkOverflow(page);
      overflowResults.push({ route: r, viewport: "390x844", theme: "light", lang: "en", ...ofCheck });
      const modName = r.replace("/admin/", "");
      file = path.join(REFINED_DIR, `390x844_${modName}_light_en.png`);
      await page.screenshot({ path: file });
      console.log(`  Saved ${modName} screenshot: ${file}`);
    }

    // 7. PackageEditorDrawer Open State
    console.log("\n--- Testing PackageEditorDrawer on Mobile ---");
    await setupAuthAndNavigate(superAdminSession, { name: "390x844", width: 390, height: 844 }, "/admin/packages", "en", "light");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const createBtn = btns.find((b) => b.textContent?.includes("Create New Package") || b.textContent?.includes("إنشاء باقة"));
      if (createBtn) createBtn.click();
    });
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    ofCheck = await checkOverflow(page);
    overflowResults.push({ route: "PackageEditorDrawer (open)", viewport: "390x844", theme: "light", lang: "en", ...ofCheck });
    file = path.join(REFINED_DIR, "390x844_package_editor_drawer_open.png");
    await page.screenshot({ path: file });
    console.log(`  Saved PackageEditorDrawer screenshot: ${file}`);

    // Save Overflow and QA Report
    const reportPath = path.join(REFINED_DIR, "refined_qa_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(overflowResults, null, 2), "utf-8");
    console.log(`\nRefined QA report written to: ${reportPath}`);

    const overflowCount = overflowResults.filter((r) => r.hasOverflow).length;
    console.log(`\nTotal viewports & scenarios tested: ${overflowResults.length}`);
    console.log(`Scenarios with horizontal overflow: ${overflowCount}`);
    if (overflowCount === 0) {
      console.log("SUCCESS: 0 horizontal overflow detected across all test matrices!");
    } else {
      console.warn("WARNING: Some viewports have horizontal overflow. Review report for details.");
    }
  } catch (err) {
    console.error("QA execution encountered error:", err);
  } finally {
    await browser.close();
  }
}

run();
