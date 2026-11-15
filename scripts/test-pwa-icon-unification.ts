import fs from "fs";
import path from "path";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

function getPngDimensions(buf: Buffer) {
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  return null;
}

console.log("\n============================================================");
console.log("   SADA OS — PWA APP ICON & FAVICON UNIFICATION AUDIT       ");
console.log("============================================================\n");

// 1. Source asset verification
console.log("--- TEST GROUP 1: Source Asset (SSOT) ---");
const masterFavicon = "B:/Work/DIGITOUS/SADA/favicon.png";
assert(fs.existsSync(masterFavicon), `Master SSOT favicon exists at ${masterFavicon}`);
const masterBuf = fs.readFileSync(masterFavicon);
const masterDims = getPngDimensions(masterBuf);
assert(masterDims !== null && masterDims.width === 1080 && masterDims.height === 1080, `Master SSOT is 1080x1080 PNG (actual: ${masterDims?.width}x${masterDims?.height})`);

// 2. Target icon files and dimensions
console.log("\n--- TEST GROUP 2: Generated PWA Icons & Favicons ---");
const expectedIcons = [
  { file: "public/icons/pwa-icon-192x192.png", width: 192, height: 192 },
  { file: "public/icons/pwa-icon-512x512.png", width: 512, height: 512 },
  { file: "public/icons/pwa-icon-180x180.png", width: 180, height: 180 },
  { file: "public/icons/pwa-icon-maskable-512x512.png", width: 512, height: 512 },
  { file: "public/icons/icon-192x192.png", width: 192, height: 192 },
  { file: "public/icons/icon-512x512.png", width: 512, height: 512 },
  { file: "public/icons/maskable-512x512.png", width: 512, height: 512 },
  { file: "public/apple-touch-icon.png", width: 180, height: 180 },
  { file: "public/favicon.png", width: 512, height: 512 },
  { file: "public/favicon-48x48.png", width: 48, height: 48 },
  { file: "public/favicon-32x32.png", width: 32, height: 32 },
  { file: "public/favicon-16x16.png", width: 16, height: 16 },
];

for (const icon of expectedIcons) {
  assert(fs.existsSync(icon.file), `${icon.file} exists on disk`);
  const buf = fs.readFileSync(icon.file);
  const dims = getPngDimensions(buf);
  assert(
    dims !== null && dims.width === icon.width && dims.height === icon.height,
    `${icon.file} has correct dimensions ${icon.width}x${icon.height} (actual: ${dims?.width}x${dims?.height})`
  );
  assert(buf.length > 500, `${icon.file} has non-trivial byte size (${buf.length} bytes)`);
}

// Check favicon.ico and favicon.svg
assert(fs.existsSync("public/favicon.ico"), "public/favicon.ico exists");
const icoBuf = fs.readFileSync("public/favicon.ico");
assert(icoBuf.length > 1000, `public/favicon.ico has valid byte size (${icoBuf.length} bytes)`);

assert(fs.existsSync("public/favicon.svg"), "public/favicon.svg exists");
const svgContent = fs.readFileSync("public/favicon.svg", "utf8");
assert(svgContent.includes("<svg") && svgContent.includes("data:image/png;base64,"), "public/favicon.svg contains embedded high-res PNG data");

// 3. Web App Manifest Audit
console.log("\n--- TEST GROUP 3: Web App Manifest Configuration ---");
const manifestPath = "public/manifest.webmanifest";
assert(fs.existsSync(manifestPath), "manifest.webmanifest exists");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert(manifest.name === "SADA OS", "manifest.name is 'SADA OS'");
assert(manifest.short_name === "SADA OS", "manifest.short_name is 'SADA OS'");
assert(manifest.start_url === "/sada-os", "manifest.start_url is '/sada-os'");
assert(manifest.scope === "/", "manifest.scope is '/'");
assert(manifest.display === "standalone", "manifest.display is 'standalone'");
assert(manifest.theme_color === "#222830", "manifest.theme_color is '#222830'");
assert(manifest.background_color === "#222830", "manifest.background_color is '#222830'");

assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, "manifest.icons contains >= 4 declarations");

let has192Any = false;
let has512Any = false;
let has512Maskable = false;

for (const icon of manifest.icons) {
  const cleanPath = path.join("public", icon.src.split("?")[0].replace(/^\//, ""));
  assert(fs.existsSync(cleanPath), `manifest icon src resolves on disk: ${icon.src} -> ${cleanPath}`);

  if (icon.sizes === "192x192" && icon.purpose === "any") has192Any = true;
  if (icon.sizes === "512x512" && icon.purpose === "any") has512Any = true;
  if (icon.sizes === "512x512" && icon.purpose === "maskable") has512Maskable = true;
}

assert(has192Any, "manifest contains 192x192 purpose: 'any' icon");
assert(has512Any, "manifest contains 512x512 purpose: 'any' icon");
assert(has512Maskable, "manifest contains 512x512 purpose: 'maskable' icon");

// 4. Head and Meta Links in __root.tsx
console.log("\n--- TEST GROUP 4: Root HTML Head & Link Tags (__root.tsx) ---");
const rootPath = "src/routes/__root.tsx";
const rootContent = fs.readFileSync(rootPath, "utf8");

assert(rootContent.includes('rel: "manifest", href: "/manifest.webmanifest?v=6"'), "Root references manifest.webmanifest?v=6");
assert(rootContent.includes('id: "sada-favicon-ico", rel: "icon", href: "/favicon.ico?v=6"'), "Root references favicon.ico?v=6");
assert(rootContent.includes('id: "sada-favicon-32", rel: "icon", href: "/favicon-32x32.png?v=6"'), "Root references favicon-32x32.png?v=6");
assert(rootContent.includes('id: "sada-favicon-16", rel: "icon", href: "/favicon-16x16.png?v=6"'), "Root references favicon-16x16.png?v=6");
assert(rootContent.includes('id: "sada-favicon-192", rel: "icon", href: "/icons/pwa-icon-192x192.png?v=6"'), "Root references pwa-icon-192x192.png?v=6");
assert(rootContent.includes('id: "sada-favicon-svg", rel: "icon", href: "/favicon.svg?v=6"'), "Root references favicon.svg?v=6");
assert(rootContent.includes('rel: "apple-touch-icon", href: "/icons/pwa-icon-180x180.png?v=6"'), "Root references apple-touch-icon at pwa-icon-180x180.png?v=6");

// 5. Service Worker Caching & Push Payload
console.log("\n--- TEST GROUP 5: Service Worker Caching & Push Alignment ---");
const swContent = fs.readFileSync("public/sw.js", "utf8");

assert(swContent.includes("const CACHE_NAME = 'sada-os-pwa-v10';"), "Service worker cache name bumped to sada-os-pwa-v10");
assert(swContent.includes("'/icons/pwa-icon-192x192.png'"), "SW STATIC_SHELL_ASSETS includes pwa-icon-192x192.png");
assert(swContent.includes("'/icons/pwa-icon-512x512.png'"), "SW STATIC_SHELL_ASSETS includes pwa-icon-512x512.png");
assert(swContent.includes("'/icons/pwa-icon-180x180.png'"), "SW STATIC_SHELL_ASSETS includes pwa-icon-180x180.png");
assert(swContent.includes("'/icons/pwa-icon-maskable-512x512.png'"), "SW STATIC_SHELL_ASSETS includes pwa-icon-maskable-512x512.png");

// 6. Push dispatcher server-side payload
const pushDispContent = fs.readFileSync("src/server/push-dispatcher.ts", "utf8");
assert(pushDispContent.includes('icon: "/icons/pwa-icon-192x192.png"'), "Push dispatcher references pwa-icon-192x192.png");
assert(pushDispContent.includes('badge: "/favicon-32x32.png"'), "Push dispatcher references favicon-32x32.png");

console.log("\n============================================================");
console.log(`RESULTS: ${passedCount}/${passedCount + failedCount} CHECKS PASSED (${failedCount} FAILED)`);
console.log("============================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
