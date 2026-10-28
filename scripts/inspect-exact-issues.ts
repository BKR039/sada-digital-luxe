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

  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });

  const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ sess, key }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "dark");
      if (sess) {
        localStorage.setItem(key, JSON.stringify(sess));
        localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
      }
    },
    { sess: data!.session, key: storageKey }
  );

  const targets = ["/admin/business-rules", "/admin/my-work", "/admin/packages", "/admin"];

  for (const route of targets) {
    console.log(`\n=== INSPECTING ${route} at 320x640 ===`);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));

    const analysis = await page.evaluate(() => {
      const cardElements = Array.from(
        document.querySelectorAll(".sada-card-base, .sada-card, [data-card], .rounded-2xl, .rounded-3xl")
      ).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 120 && rect.height > 60 && !el.matches("aside, header, #sada-mobile-bottom-nav");
      });

      const cardResults: any[] = [];
      for (const card of cardElements) {
        const cardRect = card.getBoundingClientRect();
        const issues: string[] = [];

        // Check buttons
        const btns = Array.from(card.querySelectorAll("button, a, [role='button']")) as HTMLElement[];
        for (const btn of btns) {
          const btnRect = btn.getBoundingClientRect();
          if (btnRect.width === 0 || btnRect.height === 0) continue;
          if (btnRect.right > cardRect.right + 2) {
            issues.push(`Button "${btn.textContent?.trim().slice(0, 20)}" right (${Math.round(btnRect.right)}) > card right (${Math.round(cardRect.right)})`);
          }
          if (btnRect.left < cardRect.left - 2) {
            issues.push(`Button "${btn.textContent?.trim().slice(0, 20)}" left (${Math.round(btnRect.left)}) < card left (${Math.round(cardRect.left)})`);
          }
        }

        // Check text
        const textEls = Array.from(card.querySelectorAll("p, span, div, h2, h3, h4")) as HTMLElement[];
        for (const txt of textEls) {
          if (txt.childElementCount > 2) continue;
          const txtStyle = window.getComputedStyle(txt);
          if (txtStyle.overflowX === "visible" && txt.scrollWidth > txt.clientWidth + 4) {
            issues.push(`Text uncontained "${txt.textContent?.trim().slice(0, 30)}" (scrollWidth: ${txt.scrollWidth} > clientWidth: ${txt.clientWidth})`);
          }
        }

        if (issues.length > 0) {
          cardResults.push({
            tag: card.tagName,
            className: card.className.slice(0, 80),
            title: card.querySelector("h1, h2, h3, h4, p")?.textContent?.trim().slice(0, 40),
            issues,
          });
        }
      }

      return { totalCards: cardElements.length, cardResults };
    });

    console.log(`Found ${analysis.totalCards} cards, ${analysis.cardResults.length} with issues:`);
    console.log(JSON.stringify(analysis.cardResults, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
