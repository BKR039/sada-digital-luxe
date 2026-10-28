import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

// Load .env
const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const client = createClient(supabaseUrl, anonKey);

const OUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/package_redesign_post");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  console.log("Signing in as qa.superadmin@sada.agency...");
  const authRes = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (!authRes.data?.session) {
    throw new Error("Failed to sign in: " + authRes.error?.message);
  }

  const session = authRes.data.session;
  console.log("Session acquired for:", session.user.email);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // Set local storage tokens
  await page.evaluateOnNewDocument((sess) => {
    localStorage.setItem("sada-lang", "en");
    localStorage.setItem("sada-theme", "dark");
    localStorage.setItem("sb-mtfkzabiscyleztypqks-auth-token", JSON.stringify(sess));
    localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
  }, session);

  // Helper to switch to Cards view
  const switchToCards = async () => {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const b = buttons.find((el) => el.textContent?.trim() === "Cards" || el.textContent?.trim() === "بطاقات");
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 600));
  };

  // Helper to switch to Table view
  const switchToTable = async () => {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const b = buttons.find((el) => el.textContent?.trim() === "Table" || el.textContent?.trim() === "جدول");
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 600));
  };

  // 1. Desktop 1440 - All Packages Table
  await page.setViewport({ width: 1440, height: 950 });
  await page.goto("http://localhost:3000/admin/packages", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, "post_1440_all_table.png"), fullPage: false });
  console.log("Captured: post_1440_all_table.png");

  // 2. Desktop 1440 - All Packages Cards
  await switchToCards();
  await page.screenshot({ path: path.join(OUT_DIR, "post_1440_all_cards.png"), fullPage: false });
  console.log("Captured: post_1440_all_cards.png");

  // Switch back to Table
  await switchToTable();

  // 3. Desktop 1440 - Internal Catalog
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("nav button"));
    const b = buttons.find((el) => el.textContent?.includes("Internal Catalog"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, "post_1440_internal_table.png"), fullPage: false });
  console.log("Captured: post_1440_internal_table.png");

  // 4. Desktop 1440 - Public Proposals
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("nav button"));
    const b = buttons.find((el) => el.textContent?.includes("Public Proposals"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, "post_1440_proposals_table.png"), fullPage: false });
  console.log("Captured: post_1440_proposals_table.png");

  // Switch back to All Packages
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("nav button"));
    const b = buttons.find((el) => el.textContent?.includes("All Packages"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // 5. Desktop 1280
  await page.setViewport({ width: 1280, height: 900 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, "post_1280_all_table.png"), fullPage: false });
  console.log("Captured: post_1280_all_table.png");

  // 6. Tablet Landscape 1024
  await page.setViewport({ width: 1024, height: 800 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, "post_1024_all_table.png"), fullPage: false });
  console.log("Captured: post_1024_all_table.png");

  // 7. Tablet Landscape 1024 Cards
  await switchToCards();
  await page.screenshot({ path: path.join(OUT_DIR, "post_1024_all_cards.png"), fullPage: false });
  console.log("Captured: post_1024_all_cards.png");

  // Switch back to Table
  await switchToTable();

  // 8. Tablet Portrait 768
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, "post_768_all_table.png"), fullPage: false });
  console.log("Captured: post_768_all_table.png");

  // 9. Mobile 390
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, "post_390_mobile.png"), fullPage: false });
  console.log("Captured: post_390_mobile.png");

  await browser.close();
  console.log("All post-redesign screenshots captured successfully in:", OUT_DIR);
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
