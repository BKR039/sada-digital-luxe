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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.error("Auth failed:", error);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });

  const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ sess, key }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada_language", "en");
      localStorage.setItem("sada-theme", "dark");
      localStorage.setItem("theme", "dark");
      if (sess) {
        localStorage.setItem(key, JSON.stringify(sess));
        localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
      }
    },
    { sess: data.session, key: storageKey }
  );

  console.log("\n--- DIAGNOSING /admin (Overview) ---");
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const adminDiagnostics = await page.evaluate(() => {
    const sidebar = document.querySelector(".admin-sidebar, aside");
    const bottomNav = document.querySelector("#sada-mobile-bottom-nav");
    const menuBtn = document.querySelector("button[aria-label*='menu' i], #sada-mobile-bottom-nav button:last-child");

    const sidebarInfo = sidebar
      ? {
          rect: sidebar.getBoundingClientRect(),
          display: window.getComputedStyle(sidebar).display,
          visibility: window.getComputedStyle(sidebar).visibility,
          transform: window.getComputedStyle(sidebar).transform,
          classes: sidebar.className,
        }
      : null;

    const bottomNavInfo = bottomNav
      ? {
          rect: bottomNav.getBoundingClientRect(),
          position: window.getComputedStyle(bottomNav).position,
          bottom: window.getComputedStyle(bottomNav).bottom,
          classes: bottomNav.className,
          buttonCount: bottomNav.querySelectorAll("button, a").length,
          buttons: Array.from(bottomNav.querySelectorAll("button, a")).map((b) => ({
            text: (b.textContent || "").trim(),
            ariaLabel: b.getAttribute("aria-label"),
          })),
        }
      : null;

    return { sidebarInfo, bottomNavInfo, hasMenuBtn: !!menuBtn };
  });

  console.log("Admin Sidebar info:", JSON.stringify(adminDiagnostics.sidebarInfo, null, 2));
  console.log("Admin BottomNav info:", JSON.stringify(adminDiagnostics.bottomNavInfo, null, 2));
  console.log("Admin MenuBtn exists:", adminDiagnostics.hasMenuBtn);

  console.log("\n--- DIAGNOSING /admin/business-rules (Card issues) ---");
  await page.goto(`${BASE_URL}/admin/business-rules`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const brDiagnostics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".sada-card-base, .sada-card, [data-card]"));
    const issues: any[] = [];
    for (const card of cards) {
      const cardRect = card.getBoundingClientRect();
      const title = card.querySelector("h3, h4, p.font-semibold")?.textContent?.trim() || "Card";
      
      // Interactive elements
      const btns = Array.from(card.querySelectorAll("button, a"));
      for (const b of btns) {
        const bRect = b.getBoundingClientRect();
        if (bRect.width === 0 || bRect.height === 0) continue;
        if (bRect.right > cardRect.right + 2 || bRect.left < cardRect.left - 2) {
          issues.push({
            type: "BUTTON_ESCAPE",
            title,
            btnText: b.textContent?.trim(),
            bRect: { left: bRect.left, right: bRect.right },
            cardRect: { left: cardRect.left, right: cardRect.right },
          });
        }
      }

      // Texts
      const texts = Array.from(card.querySelectorAll("p, span, div, h3, h4"));
      for (const t of texts) {
        if (t.childElementCount > 2) continue;
        const tStyle = window.getComputedStyle(t);
        if (tStyle.overflowX === "visible" && t.scrollWidth > t.clientWidth + 4) {
          issues.push({
            type: "TEXT_UNCONTAINED",
            title,
            text: t.textContent?.trim().slice(0, 30),
            scrollWidth: t.scrollWidth,
            clientWidth: t.clientWidth,
          });
        }
      }
    }
    return { cardCount: cards.length, issues };
  });

  console.log("Business rules card issues:", JSON.stringify(brDiagnostics, null, 2));

  console.log("\n--- DIAGNOSING /admin/my-work (Card issues) ---");
  await page.goto(`${BASE_URL}/admin/my-work`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const mwDiagnostics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".sada-card-base, .sada-card, [data-card]"));
    const issues: any[] = [];
    for (const card of cards) {
      const cardRect = card.getBoundingClientRect();
      const title = card.querySelector("h3, h4, p.font-semibold")?.textContent?.trim() || "Card";
      const btns = Array.from(card.querySelectorAll("button, a"));
      for (const b of btns) {
        const bRect = b.getBoundingClientRect();
        if (bRect.width === 0 || bRect.height === 0) continue;
        if (bRect.right > cardRect.right + 2 || bRect.left < cardRect.left - 2) {
          issues.push({
            type: "BUTTON_ESCAPE",
            title,
            btnText: b.textContent?.trim(),
            bRect: { left: bRect.left, right: bRect.right },
            cardRect: { left: cardRect.left, right: cardRect.right },
          });
        }
      }
      const texts = Array.from(card.querySelectorAll("p, span, div, h3, h4"));
      for (const t of texts) {
        if (t.childElementCount > 2) continue;
        const tStyle = window.getComputedStyle(t);
        if (tStyle.overflowX === "visible" && t.scrollWidth > t.clientWidth + 4) {
          issues.push({
            type: "TEXT_UNCONTAINED",
            title,
            text: t.textContent?.trim().slice(0, 30),
            scrollWidth: t.scrollWidth,
            clientWidth: t.clientWidth,
          });
        }
      }
    }
    return { cardCount: cards.length, issues };
  });

  console.log("My Work card issues:", JSON.stringify(mwDiagnostics, null, 2));

  console.log("\n--- DIAGNOSING /admin/packages (Card issues) ---");
  await page.goto(`${BASE_URL}/admin/packages`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const pkgDiagnostics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".sada-card-base, .sada-card, [data-card]"));
    const issues: any[] = [];
    for (const card of cards) {
      const cardRect = card.getBoundingClientRect();
      const title = card.querySelector("h3, h4, p.font-semibold")?.textContent?.trim() || "Card";
      const btns = Array.from(card.querySelectorAll("button, a"));
      for (const b of btns) {
        const bRect = b.getBoundingClientRect();
        if (bRect.width === 0 || bRect.height === 0) continue;
        if (bRect.right > cardRect.right + 2 || bRect.left < cardRect.left - 2) {
          issues.push({
            type: "BUTTON_ESCAPE",
            title,
            btnText: b.textContent?.trim(),
            bRect: { left: bRect.left, right: bRect.right },
            cardRect: { left: cardRect.left, right: cardRect.right },
          });
        }
      }
      const texts = Array.from(card.querySelectorAll("p, span, div, h3, h4"));
      for (const t of texts) {
        if (t.childElementCount > 2) continue;
        const tStyle = window.getComputedStyle(t);
        if (tStyle.overflowX === "visible" && t.scrollWidth > t.clientWidth + 4) {
          issues.push({
            type: "TEXT_UNCONTAINED",
            title,
            text: t.textContent?.trim().slice(0, 30),
            scrollWidth: t.scrollWidth,
            clientWidth: t.clientWidth,
          });
        }
      }
    }
    return { cardCount: cards.length, issues };
  });

  console.log("Packages card issues:", JSON.stringify(pkgDiagnostics, null, 2));

  await browser.close();
}

main().catch(console.error);
