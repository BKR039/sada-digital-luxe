import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

async function generateIcons() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}`);
  }

  const sourceFaviconPath = "B:/Work/DIGITOUS/SADA/favicon.png";
  if (!fs.existsSync(sourceFaviconPath)) {
    throw new Error(`Source favicon not found at ${sourceFaviconPath}`);
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage();
  const sourceB64 = "data:image/png;base64," + fs.readFileSync(sourceFaviconPath).toString("base64");

  // Pass sourceB64 into the page and run pure in-browser script as string to avoid tsx/esbuild __name helper injection
  const clientScript = `
    new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        function renderResized(w, h) {
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/png");
        }

        function renderCrispSmall(size) {
          var step1 = document.createElement("canvas");
          step1.width = 128;
          step1.height = 128;
          var ctx1 = step1.getContext("2d");
          ctx1.imageSmoothingEnabled = true;
          ctx1.imageSmoothingQuality = "high";
          ctx1.drawImage(img, 0, 0, 128, 128);

          var canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(step1, 0, 0, size, size);
          return canvas.toDataURL("image/png");
        }

        function renderMaskable(size) {
          var canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext("2d");

          ctx.fillStyle = "#222830";
          ctx.fillRect(0, 0, size, size);

          var targetScale = 0.88;
          var drawSize = Math.round(size * targetScale);
          var offset = Math.round((size - drawSize) / 2);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, offset, offset, drawSize, drawSize);

          return canvas.toDataURL("image/png");
        }

        resolve({
          png512: renderResized(512, 512),
          png192: renderResized(192, 192),
          png180: renderResized(180, 180),
          png48: renderCrispSmall(48),
          png32: renderCrispSmall(32),
          png16: renderCrispSmall(16),
          maskable512: renderMaskable(512)
        });
      };
      img.onerror = function(err) { reject(err); };
      img.src = window.__SOURCE_IMG__;
    });
  `;

  await page.evaluate(`window.__SOURCE_IMG__ = "${sourceB64}";`);
  const iconsData: any = await page.evaluate(clientScript);

  await browser.close();

  // Helper to convert data URL to buffer
  const toBuffer = (dataUrl: string) => Buffer.from(dataUrl.split(",")[1], "base64");

  const buf512 = toBuffer(iconsData.png512);
  const buf192 = toBuffer(iconsData.png192);
  const buf180 = toBuffer(iconsData.png180);
  const buf48 = toBuffer(iconsData.png48);
  const buf32 = toBuffer(iconsData.png32);
  const buf16 = toBuffer(iconsData.png16);
  const bufMaskable512 = toBuffer(iconsData.maskable512);

  console.log("Generated buffers:");
  console.log(`- 512x512: ${buf512.length} bytes`);
  console.log(`- 192x192: ${buf192.length} bytes`);
  console.log(`- 180x180: ${buf180.length} bytes`);
  console.log(`- 48x48: ${buf48.length} bytes`);
  console.log(`- 32x32: ${buf32.length} bytes`);
  console.log(`- 16x16: ${buf16.length} bytes`);
  console.log(`- maskable 512x512: ${bufMaskable512.length} bytes`);

  // Build SVG that embeds 512x512 base64
  const b64_512 = buf512.toString("base64");
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><image href="data:image/png;base64,${b64_512}" width="512" height="512"/></svg>`;

  // Build multi-icon .ico (16, 32, 48 PNG-based ICO)
  function createIco(images: { size: number; buffer: Buffer }[]): Buffer {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // ICO type (1 = icon)
    header.writeUInt16LE(images.length, 4); // count

    let offset = 6 + images.length * 16;
    const entries: Buffer[] = [];
    const bodies: Buffer[] = [];

    for (const img of images) {
      const entry = Buffer.alloc(16);
      entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
      entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
      entry.writeUInt8(0, 2); // color palette (0 = no palette)
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bits per pixel
      entry.writeUInt32LE(img.buffer.length, 8); // image size in bytes
      entry.writeUInt32LE(offset, 12); // file offset

      entries.push(entry);
      bodies.push(img.buffer);
      offset += img.buffer.length;
    }

    return Buffer.concat([header, ...entries, ...bodies]);
  }

  const bufIco = createIco([
    { size: 16, buffer: buf16 },
    { size: 32, buffer: buf32 },
    { size: 48, buffer: buf48 }
  ]);
  console.log(`- favicon.ico: ${bufIco.length} bytes`);

  // Write all files
  const writes = [
    // PWA canonical icons in public/icons/
    { path: "public/icons/pwa-icon-192x192.png", buf: buf192 },
    { path: "public/icons/pwa-icon-512x512.png", buf: buf512 },
    { path: "public/icons/pwa-icon-180x180.png", buf: buf180 },
    { path: "public/icons/pwa-icon-maskable-512x512.png", buf: bufMaskable512 },
    { path: "public/icons/icon-192x192.png", buf: buf192 },
    { path: "public/icons/icon-512x512.png", buf: buf512 },
    { path: "public/icons/maskable-512x512.png", buf: bufMaskable512 },

    // Root favicons in public/
    { path: "public/favicon.png", buf: buf512 },
    { path: "public/apple-touch-icon.png", buf: buf180 },
    { path: "public/favicon-48x48.png", buf: buf48 },
    { path: "public/favicon-32x32.png", buf: buf32 },
    { path: "public/favicon-16x16.png", buf: buf16 },
    { path: "public/favicon.ico", buf: bufIco },
  ];

  for (const w of writes) {
    fs.writeFileSync(w.path, w.buf);
    console.log(`  Saved ${w.path} (${w.buf.length} bytes)`);
  }

  fs.writeFileSync("public/favicon.svg", svgContent, "utf8");
  console.log(`  Saved public/favicon.svg (${svgContent.length} bytes)`);

  console.log("\nAll icons successfully generated from B:/Work/DIGITOUS/SADA/favicon.png!");
}

generateIcons().catch(console.error);
