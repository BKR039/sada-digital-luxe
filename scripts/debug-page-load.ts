import puppeteer, { type Browser } from "puppeteer-core";
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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\3bc6394f-3e07-411b-9b48-e1f05f6b43da\\screenshots";

async function run() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // First goto base to ensure origin is set
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  await page.evaluate(({ sessionData, storageKey }) => {
    localStorage.setItem("sada-lang", "ar");
    localStorage.setItem("sada-theme", "dark");
    if (sessionData) {
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    }
  }, {
    sessionData: data?.session,
    storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
  });

  await page.goto("http://localhost:3000/admin/clients/680cf516-4927-4376-9dd9-b76f3494c30b", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });

  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: path.join(outputDir, "debug_test_1440.png") });
  console.log("Screenshot debug_test_1440.png saved!");

  await browser.close();
}

run().catch(console.error);
