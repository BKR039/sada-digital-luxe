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

    page.on("requestfailed", (req) => {
      console.log(`[REQUEST FAILED]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    page.on("response", async (res) => {
      if (res.status() >= 400) {
        let body = "";
        try {
          body = await res.text();
        } catch {}
        console.log(`[HTTP ${res.status()}]: ${res.request().method()} ${res.url()} => ${body}`);
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[BROWSER ERROR]:`, msg.text());
      }
    });

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

    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2", timeout: 35000 });
    await new Promise((r) => setTimeout(r, 4000));
  } finally {
    await browser.close();
  }
}

run();
