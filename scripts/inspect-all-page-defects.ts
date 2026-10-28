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

async function main() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const routes = [
    "/admin",
    "/admin/business-rules",
    "/admin/team-workload",
    "/admin/client-workspaces",
    "/admin/my-work",
    "/admin/calendar",
    "/admin/analytics",
    "/admin/finance",
    "/admin/accounts",
    "/admin/packages",
    "/admin/workflow-templates",
  ];

  const viewports = [
    { width: 320, height: 640, label: "320x640" },
    { width: 360, height: 800, label: "360x800" },
    { width: 390, height: 844, label: "390x844" },
  ];

  const languages = ["en", "ar"];

  const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";

  for (const vp of viewports) {
    for (const lang of languages) {
      console.log(`\n================================================================`);
      console.log(`AUDITING VIEWPORT: ${vp.label} | LANG: ${lang}`);
      console.log(`================================================================`);

      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ sess, key, l }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada_language", l);
          localStorage.setItem("sada-theme", "dark");
          localStorage.setItem("theme", "dark");
          if (sess) {
            localStorage.setItem(key, JSON.stringify(sess));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
          }
        },
        { sess: data!.session, key: storageKey, l: lang }
      );

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
        await new Promise((r) => setTimeout(r, 1800));

        const pageResult = await page.evaluate(() => {
          const docEl = document.documentElement;
          const bodyEl = document.body;
          const docOverflow = Math.max(0, docEl.scrollWidth - window.innerWidth, bodyEl.scrollWidth - window.innerWidth);

          // Find any elements exceeding the viewport
          const escapingElements: any[] = [];
          const allEls = Array.from(document.querySelectorAll("body *"));
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            // Ignore intentional scroll elements
            const style = window.getComputedStyle(el);
            if (style.overflowX === "auto" || style.overflowX === "scroll") continue;

            // If an element is physically rendered beyond the viewport edge:
            if (rect.right > window.innerWidth + 2 && !el.closest("[style*='overflow'], .overflow-x-auto, .overflow-hidden")) {
              escapingElements.push({
                tag: el.tagName,
                className: (el.className && typeof el.className === "string") ? el.className.slice(0, 60) : "",
                text: (el.textContent || "").trim().slice(0, 30),
                rectRight: Math.round(rect.right),
              });
            }
          }

          // Check cards
          const cards = Array.from(document.querySelectorAll(".sada-card-base, .sada-card, [data-card]"));
          const cardIssues: any[] = [];
          for (const card of cards) {
            const cardRect = card.getBoundingClientRect();
            const btns = Array.from(card.querySelectorAll("button, a, [role='button']")) as HTMLElement[];
            for (const b of btns) {
              const bRect = b.getBoundingClientRect();
              if (bRect.width === 0 || bRect.height === 0) continue;
              // If button is outside card bounds and NOT inside a scroll container
              if ((bRect.right > cardRect.right + 2 || bRect.left < cardRect.left - 2) && !b.closest(".overflow-x-auto, .overflow-y-auto")) {
                cardIssues.push({
                  card: card.querySelector("h2, h3, h4, p")?.textContent?.trim().slice(0, 30),
                  btn: b.textContent?.trim().slice(0, 20),
                  bRect: Math.round(bRect.right),
                  cardRect: Math.round(cardRect.right),
                });
              }
            }
          }

          return { docOverflow, escapingCount: escapingElements.length, escapingElements: escapingElements.slice(0, 3), cardIssues };
        });

        const status = pageResult.docOverflow === 0 && pageResult.escapingCount === 0 && pageResult.cardIssues.length === 0 ? "✅ PASS" : "⚠️ ISSUE";
        console.log(`  ${status} ${route}: overflow=${pageResult.docOverflow}px, escaping=${pageResult.escapingCount}, cardIssues=${pageResult.cardIssues.length}`);
        if (pageResult.cardIssues.length > 0) {
          console.log(`     Cards:`, JSON.stringify(pageResult.cardIssues));
        }
        if (pageResult.escapingCount > 0) {
          console.log(`     Escaping:`, JSON.stringify(pageResult.escapingElements));
        }
      }

      await page.close();
    }
  }

  await browser.close();
}

main().catch(console.error);
