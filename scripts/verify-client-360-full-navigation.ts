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

async function main() {
  console.log("=== COMPREHENSIVE VERIFICATION OF PROPOSED CLIENT 360 NAV ===");
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);
  const clientId = clients![0].id;

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(
    ({ s, k }) => {
      localStorage.setItem(k, JSON.stringify(s));
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "dark");
    },
    { s: authData!.session, k: storageKey }
  );

  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Restructure DOM in test page to simulate the clean layout
  await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    const rootDiv = main.firstElementChild as HTMLElement;
    const nav = document.querySelector(".sticky") as HTMLElement;
    const overviewSec = document.getElementById("overview-section");

    if (!nav || !main || !rootDiv || !overviewSec) return;

    // 1. Move nav to the top of rootDiv
    rootDiv.insertBefore(nav, rootDiv.firstElementChild);

    // 2. Style nav
    nav.id = "client-360-nav-wrapper";
    nav.setAttribute("data-testid", "client-360-sticky-nav");
    nav.style.position = "sticky";
    nav.style.top = "0px";
    nav.style.zIndex = "35";
    nav.style.backgroundColor = "var(--background)";
    nav.style.borderBottom = "1px solid var(--border)";

    // 3. Move the header card and metrics cards into overviewSec
    // Children between nav and overviewSec
    const children = Array.from(rootDiv.children);
    const navIdx = children.indexOf(nav);
    const secIdx = children.indexOf(overviewSec);

    const itemsToMove: Element[] = [];
    for (let i = navIdx + 1; i < secIdx; i++) {
      itemsToMove.push(children[i]);
    }

    // Insert itemsToMove at the beginning of overviewSec
    itemsToMove.reverse().forEach((item) => {
      overviewSec.insertBefore(item, overviewSec.firstElementChild);
    });

    // Provide scrollToSection helper
    (window as any).__scrollToSec = (secId: string) => {
      if (secId === "overview-section") {
        main.scrollTo({ top: 0, behavior: "instant" as any });
        return;
      }
      const targetEl = document.getElementById(secId);
      if (targetEl) {
        const mainRect = main.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const navBottomRel = navRect.bottom - mainRect.top;
        const currentTargetTopRel = targetRect.top - mainRect.top;
        const delta = currentTargetTopRel - (navBottomRel + 24);
        main.scrollTo({ top: Math.max(0, main.scrollTop + delta), behavior: "instant" as any });
      }
    };
  });

  // Verify all 7 sections clearance
  const sections = [
    { id: "overview-section", label: "Overview 360" },
    { id: "services-section", label: "Services & Package" },
    { id: "delivery-section", label: "Delivery Center" },
    { id: "team-section", label: "Team & Work" },
    { id: "financial-section", label: "Financial & Ads" },
    { id: "memory-section", label: "Client Memory" },
    { id: "history-section", label: "Work History" },
  ];

  console.log("\n--- Testing Section Nav Jump & Clearance ---");
  for (const sec of sections) {
    await page.evaluate((sId) => {
      (window as any).__scrollToSec(sId);
    }, sec.id);

    await new Promise((r) => setTimeout(r, 200));

    const check = await page.evaluate((sId) => {
      const nav = document.getElementById("client-360-nav-wrapper")!;
      const targetEl = document.getElementById(sId)!;
      const h2 = targetEl.querySelector("h2") || targetEl.querySelector("h1");

      const navRect = nav.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const h2Rect = h2 ? h2.getBoundingClientRect() : targetRect;

      const gap = h2Rect.top - navRect.bottom;
      const isCovered = h2Rect.top < navRect.bottom;

      return {
        sectionId: sId,
        navBottom: navRect.bottom,
        headingTop: h2Rect.top,
        gap,
        isCovered,
      };
    }, sec.id);

    console.log(
      `Section [${sec.label}]: navBottom=${check.navBottom.toFixed(1)}, headingTop=${check.headingTop.toFixed(1)}, gap=${check.gap.toFixed(1)}px (PASS: >= 12px), covered=${check.isCovered}`
    );
    if (check.gap < 12 || check.isCovered) {
      throw new Error(`Assertion failed for ${sec.label}: gap=${check.gap}px, covered=${check.isCovered}`);
    }
  }

  console.log("\nALL 7 SECTIONS VERIFIED WITH GAP >= 12px AND NO OVERLAPPING!");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
