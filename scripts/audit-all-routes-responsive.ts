import puppeteer from "puppeteer-core";
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
const OUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/universal_audit");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

interface AuditResult {
  route: string;
  viewport: string;
  docOverflow: number;
  overflowingElements: Array<{ tag: string; className: string; textSnippet: string; scrollWidth: number; clientWidth: number }>;
  clippedButtonsOrTabs: string[];
  consoleErrors: string[];
}

async function auditAllRoutes() {
  console.log("Signing in as super admin...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.error("Auth error:", error);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";

  const routes = [
    "/admin",
    "/admin/my-work",
    "/admin/client-workspaces",
    "/admin/sales",
    "/admin/calendar",
    "/admin/team-workload",
    "/admin/packages",
    "/admin/analytics",
    "/admin/accounts",
    "/admin/business-rules",
    "/admin/workflow-templates",
    "/admin/contact",
    "/admin/finance",
    "/admin/projects",
    "/admin/reels",
    "/admin/blog",
    "/admin/products",
    "/admin/testimonials",
    "/pricing",
    "/services",
  ];

  const viewports = [
    { width: 320, height: 640, label: "320x640", isMobile: true, lang: "en" },
    { width: 360, height: 800, label: "360x800", isMobile: true, lang: "en" },
    { width: 360, height: 800, label: "360x800_ar", isMobile: true, lang: "ar" },
    { width: 390, height: 844, label: "390x844", isMobile: true, lang: "en" },
    { width: 390, height: 844, label: "390x844_ar", isMobile: true, lang: "ar" },
    { width: 430, height: 932, label: "430x932", isMobile: true, lang: "en" },
    { width: 768, height: 1024, label: "768x1024", isMobile: false, lang: "en" },
    { width: 1280, height: 800, label: "1280x800", isMobile: false, lang: "en" },
  ];

  const results: AuditResult[] = [];

  for (const vp of viewports) {
    console.log(`\n=== Scanning viewports: ${vp.label} (Lang: ${vp.lang}) ===`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.isMobile });

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Seed session
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ sessionData, key, lang }) => {
        localStorage.setItem("sada-lang", lang);
        localStorage.setItem("sada-theme", "dark");
        if (sessionData) {
          localStorage.setItem(key, JSON.stringify(sessionData));
          localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
        }
      },
      { sessionData: data.session, key: storageKey, lang: vp.lang }
    );

    for (const route of routes) {
      pageErrors.length = 0;
      console.log(`Auditing ${route} at ${vp.label}...`);
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 25000 });
        await new Promise((r) => setTimeout(r, 2000));

        // Evaluate layout defects
        const metrics = await page.evaluate(() => {
          const docEl = document.documentElement;
          const bodyEl = document.body;
          const docOverflow = Math.max(0, docEl.scrollWidth - window.innerWidth, bodyEl.scrollWidth - window.innerWidth);

          const overflowingElements: Array<{ tag: string; className: string; textSnippet: string; scrollWidth: number; clientWidth: number }> = [];
          const all = Array.from(document.querySelectorAll("*"));

          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;

            const style = window.getComputedStyle(el);
            const className = (el.className && typeof el.className === "string") ? el.className.slice(0, 80) : "";
            
            // Ignore screen-reader utility elements
            if (className.includes("sr-only")) continue;

            // Ignore intentional scroll containers
            if (style.overflowX === "auto" || style.overflowX === "scroll") continue;

            // Ignore intentional CSS ellipsis truncation (text is bounded and clipped with '...')
            if ((style.overflowX === "hidden" || style.overflowX === "clip") && style.textOverflow === "ellipsis") continue;

            // If an element has visible overflow and its content is wider than client width by > 3px:
            // This is genuine uncontained text escaping the container boundaries!
            if (style.overflowX === "visible" && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 3) {
              const tag = el.tagName.toLowerCase();
              const textSnippet = (el.textContent || "").trim().slice(0, 40);
              if (textSnippet && !['html', 'body', '#sada-admin-main'].includes(tag) && !className.includes('admin-main') && !className.includes('admin-shell')) {
                overflowingElements.push({
                  tag,
                  className,
                  textSnippet,
                  scrollWidth: (el as HTMLElement).scrollWidth,
                  clientWidth: (el as HTMLElement).clientWidth
                });
              }
            }
          }

          // Check tab and button clippings where text is escaping without truncation
          const clipped: string[] = [];
          const buttonsAndTabs = Array.from(document.querySelectorAll("button, [role='tab'], a.btn"));
          for (const b of buttonsAndTabs) {
            const style = window.getComputedStyle(b);
            if (style.overflowX === "visible" && (b as HTMLElement).scrollWidth > (b as HTMLElement).clientWidth + 3) {
              clipped.push(`"${(b.textContent || '').trim().slice(0, 25)}" (${b.tagName}, ${(b as HTMLElement).clientWidth}px vs ${(b as HTMLElement).scrollWidth}px)`);
            }
          }

          return { docOverflow, overflowingElements: overflowingElements.slice(0, 10), clipped };
        });

        const routeSanitized = route.replace(/\//g, "_");
        const shotPath = path.join(OUT_DIR, `${vp.label}${routeSanitized}.png`);
        await page.screenshot({ path: shotPath });

        results.push({
          route,
          viewport: vp.label,
          docOverflow: metrics.docOverflow,
          overflowingElements: metrics.overflowingElements,
          clippedButtonsOrTabs: metrics.clipped,
          consoleErrors: [...pageErrors]
        });

        if (metrics.docOverflow > 0 || metrics.overflowingElements.length > 0 || metrics.clipped.length > 0) {
          console.warn(`  ⚠️ Defects on ${route}: docOverflow=${metrics.docOverflow}px, overflowingElements=${metrics.overflowingElements.length}, clipped=${metrics.clipped.length}`);
          if (metrics.clipped.length > 0) console.warn(`    Clipped items:`, metrics.clipped);
          if (metrics.overflowingElements.length > 0) console.warn(`    First 3 overflowing elements:`, metrics.overflowingElements.slice(0, 3));
        } else {
          console.log(`  ✅ ${route} passed geometry checks.`);
        }
      } catch (err: any) {
        console.error(`  ❌ Failed loading ${route}:`, err.message);
        results.push({
          route,
          viewport: vp.label,
          docOverflow: -1,
          overflowingElements: [],
          clippedButtonsOrTabs: [],
          consoleErrors: [err.message]
        });
      }
    }
    await page.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, "audit_summary.json"),
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log(`\nAudit finished! Wrote summary to ${path.join(OUT_DIR, "audit_summary.json")}`);
}

auditAllRoutes().catch((e) => {
  console.error("Audit error:", e);
  process.exit(1);
});
