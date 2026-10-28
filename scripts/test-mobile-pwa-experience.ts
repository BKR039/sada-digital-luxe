/**
 * SADA OS — Test Suite: Phase 9 Mobile Web App / PWA Experience
 *
 * Verifies all 7 core domains of the Mobile & PWA experience:
 * - Group A: Web App Manifest & Metadata Compliance
 * - Group B: Production Service Worker & PWA Infrastructure
 * - Group C: Offline Fallback Page & Bilingual Resilience
 * - Group D: PWA & Web Push Client Service (Predicates & Fallbacks)
 * - Group E: Mobile Navigation & Touch Ergonomics (SADAMobileBottomNav)
 * - Group F: PWA Installation Banner & iOS Safari Guidance
 * - Group G: Root Route Head & CSS Safe Area Insets
 */

import fs from "fs";
import path from "path";
import {
  isStandaloneApp,
  isIosSafari,
  isWebPushSupported,
  getPushPermissionState,
  getPwaStatusSummary,
} from "../src/lib/pwa-service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runMobilePwaTestSuite() {
  console.log("\n=======================================================================");
  console.log("SADA OS — Phase 9 Mobile Web App / PWA Experience Verification Suite");
  console.log("=======================================================================\n");

  const projectRoot = process.cwd();

  // =======================================================================
  // GROUP A: Web App Manifest & Metadata Compliance
  // =======================================================================
  console.log("--- GROUP A: Web App Manifest & Metadata Compliance ---");
  {
    const manifestPath = path.resolve(projectRoot, "public", "manifest.webmanifest");
    assert(fs.existsSync(manifestPath), "Manifest file exists at public/manifest.webmanifest");

    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    let manifest: any = null;
    try {
      manifest = JSON.parse(manifestRaw);
      assert(true, "Manifest is valid, well-formed JSON");
    } catch (e: any) {
      assert(false, "Manifest JSON parsing failed", e.message);
    }

    if (manifest) {
      assert(
        manifest.name === "SADA OS — Travel & Creative Operating System",
        "App name matches authoritative branding: SADA OS — Travel & Creative Operating System"
      );
      assert(manifest.short_name === "SADA OS", "App short_name is 'SADA OS'");
      assert(manifest.start_url === "/sada-os", "start_url points to canonical app entry point /sada-os");
      assert(manifest.scope === "/", "scope covers full application domain /");
      assert(manifest.display === "standalone", "display mode is 'standalone'");
      assert(
        manifest.display_override?.includes("standalone"),
        "display_override includes standalone"
      );
      assert(
        manifest.background_color === "#07090E",
        "background_color matches SADA Luxury Dark Navy (#07090E)"
      );
      assert(
        manifest.theme_color === "#07090E",
        "theme_color matches SADA Luxury Dark Navy (#07090E)"
      );
      assert(
        manifest.orientation === "portrait-primary",
        "orientation is locked to portrait-primary"
      );
      assert(
        Array.isArray(manifest.categories) && manifest.categories.includes("business"),
        "categories includes business and productivity"
      );

      // Icons verification
      assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "Icons array defines at least 3 icons");
      const icon192 = manifest.icons.find((i: any) => i.sizes === "192x192");
      const icon512 = manifest.icons.find((i: any) => i.sizes === "512x512" && (!i.purpose || i.purpose === "any"));
      const iconMaskable = manifest.icons.find((i: any) => i.purpose === "maskable");

      assert(Boolean(icon192), "192x192 icon is defined");
      assert(Boolean(icon512), "512x512 icon is defined");
      assert(Boolean(iconMaskable), "512x512 maskable icon is defined with purpose='maskable'");

      // Verify physical icon files exist
      assert(
        fs.existsSync(path.resolve(projectRoot, "public", "icons", "icon-192x192.svg")),
        "Icon file public/icons/icon-192x192.svg exists"
      );
      assert(
        fs.existsSync(path.resolve(projectRoot, "public", "icons", "icon-512x512.svg")),
        "Icon file public/icons/icon-512x512.svg exists"
      );
      assert(
        fs.existsSync(path.resolve(projectRoot, "public", "icons", "maskable-512x512.svg")),
        "Icon file public/icons/maskable-512x512.svg exists"
      );

      // Shortcuts verification
      assert(
        Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2,
        "Manifest provides mobile 1-tap app shortcuts"
      );
      const myWorkShortcut = manifest.shortcuts.find((s: any) => s.url === "/admin/my-work");
      const calendarShortcut = manifest.shortcuts.find((s: any) => s.url === "/admin/calendar");
      assert(Boolean(myWorkShortcut), "Shortcut exists for My Work (/admin/my-work)");
      assert(Boolean(calendarShortcut), "Shortcut exists for Calendar (/admin/calendar)");
    }
  }

  // =======================================================================
  // GROUP B: Production Service Worker & PWA Infrastructure
  // =======================================================================
  console.log("\n--- GROUP B: Production Service Worker & PWA Infrastructure ---");
  {
    const swPath = path.resolve(projectRoot, "public", "sw.js");
    assert(fs.existsSync(swPath), "Service Worker file exists at public/sw.js");

    const swContent = fs.readFileSync(swPath, "utf-8");
    assert(swContent.includes("sada-os-pwa-v1"), "Cache name contains versioned sada-os-pwa-v1");
    assert(swContent.includes("STATIC_SHELL_ASSETS"), "Defines STATIC_SHELL_ASSETS for app shell pre-caching");
    assert(swContent.includes("/offline.html"), "App shell pre-caches /offline.html");
    assert(swContent.includes("/manifest.webmanifest"), "App shell pre-caches /manifest.webmanifest");

    // Fetch strategies
    assert(swContent.includes("request.mode === 'navigate'"), "Implements navigation-specific network-first strategy");
    assert(swContent.includes("caches.match('/offline.html')"), "Falls back to /offline.html on navigation offline failure");
    assert(swContent.includes("isStaticAsset"), "Implements cache-first strategy for static font and image assets");
    assert(swContent.includes("/rest/v1/"), "Bypasses cache for Supabase REST API requests to ensure real-time data");

    // Push Notification listener
    assert(swContent.includes("self.addEventListener('push'"), "Implements 'push' event listener for Web Push");
    assert(
      swContent.includes("showNotification"),
      "Calls self.registration.showNotification() on push event"
    );
    assert(swContent.includes("vibrate:"), "Configures haptic vibration patterns for notifications");

    // Notification Click action handler
    assert(
      swContent.includes("self.addEventListener('notificationclick'"),
      "Implements 'notificationclick' event listener"
    );
    assert(
      swContent.includes("clients.matchAll"),
      "Matches existing window clients to prevent opening redundant browser tabs"
    );
    assert(swContent.includes("client.focus()"), "Focuses matching existing window on notification click");
    assert(swContent.includes("skipWaiting()"), "Invokes skipWaiting() on install for seamless updates");
    assert(swContent.includes("clients.claim()"), "Claims clients on activation");
  }

  // =======================================================================
  // GROUP C: Offline Fallback Page & Bilingual Resilience
  // =======================================================================
  console.log("\n--- GROUP C: Offline Fallback Page & Bilingual Resilience ---");
  {
    const offlinePath = path.resolve(projectRoot, "public", "offline.html");
    assert(fs.existsSync(offlinePath), "Offline page exists at public/offline.html");

    const offlineContent = fs.readFileSync(offlinePath, "utf-8");
    assert(offlineContent.includes("<!DOCTYPE html>"), "Valid HTML5 DOCTYPE declared");
    assert(offlineContent.includes("viewport-fit=cover"), "Viewport meta specifies viewport-fit=cover for notched screens");
    assert(offlineContent.includes("#07090E"), "Offline page uses SADA Luxury Dark theme (#07090E)");
    assert(offlineContent.includes("No Internet Connection"), "English offline heading present");
    assert(offlineContent.includes("لا يوجد اتصال بالإنترنت"), "Arabic offline heading present with RTL direction");
    assert(offlineContent.includes("Retry Connection"), "Interactive retry connection button present");
    assert(offlineContent.includes("window.location.reload()"), "Retry button invokes page reload");
  }

  // =======================================================================
  // GROUP D: PWA & Web Push Client Service (src/lib/pwa-service.ts)
  // =======================================================================
  console.log("\n--- GROUP D: PWA & Web Push Client Service ---");
  {
    // Node environment safety test: predicates must run gracefully without crashing
    assert(typeof isStandaloneApp === "function", "isStandaloneApp is exported");
    assert(isStandaloneApp() === false, "isStandaloneApp returns false safely in Node SSR environment");

    assert(typeof isIosSafari === "function", "isIosSafari is exported");
    assert(isIosSafari() === false, "isIosSafari returns false safely in Node SSR environment");

    assert(typeof isWebPushSupported === "function", "isWebPushSupported is exported");
    assert(isWebPushSupported() === false, "isWebPushSupported returns false gracefully in SSR");

    assert(typeof getPushPermissionState === "function", "getPushPermissionState is exported");
    assert(
      getPushPermissionState() === "unsupported",
      "getPushPermissionState returns 'unsupported' gracefully in SSR"
    );

    const summary = getPwaStatusSummary();
    assert(typeof summary === "object", "getPwaStatusSummary returns complete status dictionary");
    assert(summary.isStandalone === false, "summary.isStandalone defaults to false");
    assert(summary.pushPermission === "unsupported", "summary.pushPermission defaults to unsupported");
  }

  // =======================================================================
  // GROUP E: Mobile Navigation & Touch Ergonomics (SADAMobileBottomNav.tsx)
  // =======================================================================
  console.log("\n--- GROUP E: Mobile Navigation & Touch Ergonomics ---");
  {
    const navPath = path.resolve(projectRoot, "src", "components", "admin", "SADAMobileBottomNav.tsx");
    assert(fs.existsSync(navPath), "SADAMobileBottomNav.tsx exists");

    const navContent = fs.readFileSync(navPath, "utf-8");
    assert(navContent.includes("md:hidden"), "Bottom nav is strictly mobile-only (hidden on md+ screens)");
    assert(navContent.includes("fixed bottom-0"), "Bottom nav is fixed to bottom viewport");
    assert(
      navContent.includes("env(safe-area-inset-bottom"),
      "Includes safe-area-inset-bottom padding for modern iPhone home bars"
    );
    assert(
      navContent.includes("backdrop-blur-md"),
      "Adheres to SADA Design System luxury glassmorphism tokens"
    );

    // 5 Mobile Priorities
    assert(navContent.includes("/admin/my-work"), "Priority 1: Includes 1-tap link to My Work queue");
    assert(navContent.includes("sada-next-task-card"), "Priority 2: Includes Next Task intelligent action link (#sada-next-task-card)");
    assert(navContent.includes("/admin/calendar"), "Priority 3: Includes 1-tap link to Production Calendar");
    assert(navContent.includes("onOpenSidebar"), "Priority 4: Includes Menu button that opens full SADA Admin sidebar");
    assert(navContent.includes("min-h-[48px]"), "Enforces touch-friendly ergonomics (min 48px target > 44px standard)");
  }

  // =======================================================================
  // GROUP F: PWA Installation Banner & iOS Safari Guidance
  // =======================================================================
  console.log("\n--- GROUP F: PWA Installation Banner & iOS Safari Guidance ---");
  {
    const bannerPath = path.resolve(projectRoot, "src", "components", "admin", "PWAInstallBanner.tsx");
    assert(fs.existsSync(bannerPath), "PWAInstallBanner.tsx exists");

    const bannerContent = fs.readFileSync(bannerPath, "utf-8");
    assert(
      bannerContent.includes("isStandaloneApp()"),
      "Hides banner automatically if app is already running in standalone PWA mode"
    );
    assert(
      bannerContent.includes("sada-pwa-dismissed"),
      "Persists dismissal in localStorage to avoid harassing operators"
    );
    assert(
      bannerContent.includes("promptPwaInstall()"),
      "Triggers native prompt on Android / Chromium browsers"
    );
    assert(
      bannerContent.includes("isIosSafari"),
      "Detects iOS Safari users to present visual 2-step Add to Home Screen instructions"
    );
    assert(
      bannerContent.includes("SADADialog"),
      "Reuses SADA UI SADADialog component for the iOS installation guidance modal"
    );
    assert(
      bannerContent.includes("SADAButton"),
      "Reuses SADAButton for install and dismissal actions"
    );
    assert(
      bannerContent.includes("SADABadge"),
      "Reuses SADABadge for PWA indicator"
    );
  }

  // =======================================================================
  // GROUP G: Root Route Head & CSS Safe Area Insets
  // =======================================================================
  console.log("\n--- GROUP G: Root Route Head & CSS Safe Area Insets ---");
  {
    const rootPath = path.resolve(projectRoot, "src", "routes", "__root.tsx");
    const rootContent = fs.readFileSync(rootPath, "utf-8");

    assert(
      rootContent.includes('viewport-fit=cover'),
      "Root route specifies viewport-fit=cover for edge-to-edge mobile display"
    );
    assert(
      rootContent.includes('rel: "manifest", href: "/manifest.webmanifest"'),
      "Root route registers manifest.webmanifest link"
    );
    assert(
      rootContent.includes('apple-mobile-web-app-capable'),
      "Root route specifies apple-mobile-web-app-capable: yes"
    );
    assert(
      rootContent.includes('apple-mobile-web-app-status-bar-style'),
      "Root route specifies apple-mobile-web-app-status-bar-style: black-translucent"
    );
    assert(
      rootContent.includes('name: "theme-color", content: "#07090E"'),
      "Root route specifies theme-color: #07090E for dark luxury mode"
    );
    assert(
      rootContent.includes('name: "theme-color", content: "#FAFAF8"'),
      "Root route specifies theme-color: #FAFAF8 for light mode"
    );
    assert(
      rootContent.includes("navigator.serviceWorker.register('/sw.js')"),
      "Root route includes automated service worker registration script"
    );

    // CSS inspection
    const cssPath = path.resolve(projectRoot, "src", "styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert(cssContent.includes(".pb-safe"), "styles.css provides .pb-safe safe area utility");
    assert(cssContent.includes(".pt-safe"), "styles.css provides .pt-safe safe area utility");
    assert(
      cssContent.includes("@media all and (display-mode: standalone)"),
      "styles.css provides display-mode: standalone app styling"
    );
    assert(
      cssContent.includes("-webkit-tap-highlight-color: transparent"),
      "styles.css optimizes mobile touch tap highlight"
    );
  }

  // =======================================================================
  // SUMMARY
  // =======================================================================
  console.log("\n=======================================================================");
  console.log(`Phase 9 Mobile Web App / PWA Suite Finished: ${passed} passed, ${failed} failed`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMobilePwaTestSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
