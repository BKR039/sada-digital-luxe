import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

async function verifyVisual() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage();

  const toB64 = (filePath: string) => "data:image/png;base64," + fs.readFileSync(filePath).toString("base64");

  const sourceB64 = toB64("B:/Work/DIGITOUS/SADA/favicon.png");
  const pwa192B64 = toB64("public/icons/pwa-icon-192x192.png");
  const pwa512B64 = toB64("public/icons/pwa-icon-512x512.png");
  const pwa180B64 = toB64("public/icons/pwa-icon-180x180.png");
  const maskableB64 = toB64("public/icons/pwa-icon-maskable-512x512.png");
  const favPngB64 = toB64("public/favicon.png");
  const fav32B64 = toB64("public/favicon-32x32.png");
  const fav16B64 = toB64("public/favicon-16x16.png");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>SADA Unified PWA Icons Visual Verification</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0B0F17;
          color: #F8FAFC;
          padding: 30px;
          margin: 0;
        }
        h1 { font-size: 24px; margin-bottom: 8px; color: #5CE1E6; }
        p { color: #94A3B8; font-size: 14px; margin-bottom: 24px; }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        .card {
          background: #111827;
          border: 1px solid #1F2937;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .card h3 {
          font-size: 14px;
          margin: 0 0 4px 0;
          color: #E2E8F0;
        }
        .card .dims {
          font-size: 12px;
          color: #0878E8;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .preview-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-image: linear-gradient(45deg, #1F2937 25%, transparent 25%), 
                            linear-gradient(-45deg, #1F2937 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #1F2937 75%), 
                            linear-gradient(-45deg, transparent 75%, #1F2937 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          background-color: #0F172A;
          border: 1px solid #374151;
          border-radius: 12px;
          padding: 12px;
          min-height: 180px;
          min-width: 180px;
        }
        .preview-box img {
          max-width: 160px;
          max-height: 160px;
          display: block;
        }
        .mask-test {
          border-radius: 50%;
          overflow: hidden;
          width: 140px;
          height: 140px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mask-test img {
          width: 140px;
          height: 140px;
        }
      </style>
    </head>
    <body>
      <h1>SADA OS — Unified PWA Icon & Favicon Verification</h1>
      <p>Single source of truth: <code>B:/Work/DIGITOUS/SADA/favicon.png</code> (1080x1080)</p>

      <div class="grid">
        <div class="card">
          <h3>Source Favicon (Master SSOT)</h3>
          <div class="dims">1080 × 1080 px</div>
          <div class="preview-box">
            <img src="${sourceB64}" />
          </div>
        </div>

        <div class="card">
          <h3>pwa-icon-512x512.png</h3>
          <div class="dims">512 × 512 px (purpose: any)</div>
          <div class="preview-box">
            <img src="${pwa512B64}" />
          </div>
        </div>

        <div class="card">
          <h3>pwa-icon-192x192.png</h3>
          <div class="dims">192 × 192 px (purpose: any)</div>
          <div class="preview-box">
            <img src="${pwa192B64}" />
          </div>
        </div>

        <div class="card">
          <h3>pwa-icon-180x180.png / Apple Touch</h3>
          <div class="dims">180 × 180 px</div>
          <div class="preview-box">
            <img src="${pwa180B64}" />
          </div>
        </div>

        <div class="card">
          <h3>pwa-icon-maskable-512x512.png</h3>
          <div class="dims">512 × 512 px (Full Bleed)</div>
          <div class="preview-box">
            <img src="${maskableB64}" />
          </div>
        </div>

        <div class="card">
          <h3>Android Circle Mask Simulation</h3>
          <div class="dims">50% Circular Clip Test</div>
          <div class="preview-box">
            <div class="mask-test">
              <img src="${maskableB64}" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>favicon.png</h3>
          <div class="dims">512 × 512 px</div>
          <div class="preview-box">
            <img src="${favPngB64}" />
          </div>
        </div>

        <div class="card">
          <h3>favicon-32x32.png & 16x16</h3>
          <div class="dims">32px & 16px (Scaled Preview)</div>
          <div class="preview-box" style="flex-direction:row; gap:16px;">
            <img src="${fav32B64}" style="width:32px; height:32px;" />
            <img src="${fav16B64}" style="width:16px; height:16px;" />
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.setViewport({ width: 1440, height: 900 });

  fs.mkdirSync("docs/screenshots/pwa_icon_unification", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/pwa_icon_unification/unified_icons_verification.png", fullPage: true });
  console.log("Visual verification saved to docs/screenshots/pwa_icon_unification/unified_icons_verification.png");

  await browser.close();
}

verifyVisual().catch(console.error);
