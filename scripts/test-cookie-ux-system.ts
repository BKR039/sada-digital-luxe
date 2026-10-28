/**
 * SADA OS — Cookie & UX Preferences Verification Suite
 * Tests cookie consent persistence, reading progress memory,
 * font size customization, and privacy purging invariants.
 */

// Mock browser document.cookie and localStorage BEFORE importing cookie-service
const cookieStore = new Map<string, string>();
const localStore = new Map<string, string>();

(global as any).document = {
  get cookie() {
    const pairs: string[] = [];
    cookieStore.forEach((val, key) => {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    });
    return pairs.join("; ");
  },
  set cookie(str: string) {
    const parts = str.split(";");
    const first = parts[0].trim();
    const eqIdx = first.indexOf("=");
    if (eqIdx !== -1) {
      const key = decodeURIComponent(first.slice(0, eqIdx).trim());
      const val = decodeURIComponent(first.slice(eqIdx + 1).trim());
      const isMaxAgeZero = parts.some(p => p.trim().toLowerCase() === "max-age=0");
      if (isMaxAgeZero || val === "") {
        cookieStore.delete(key);
      } else {
        cookieStore.set(key, val);
      }
    }
  },
};

(global as any).localStorage = {
  getItem(key: string) {
    return localStore.get(key) || null;
  },
  setItem(key: string, value: string) {
    localStore.set(key, String(value));
  },
  removeItem(key: string) {
    localStore.delete(key);
  },
  clear() {
    localStore.clear();
  },
};

(global as any).window = {
  location: { protocol: "https:", hostname: "localhost" },
  dispatchEvent(ev: any) {
    return true;
  },
};

async function runCookieTests() {
  // Dynamically import cookie service after mocks
  const {
    saveCookieConsent,
    getCookieConsent,
    isReadingMemoryEnabled,
    saveReadingProgress,
    getReadingProgress,
    getReadingFontSize,
    setReadingFontSize,
    deleteCookie,
  } = await import("../src/lib/cookie-service");

  interface TestReport {
    name: string;
    passed: boolean;
    error?: string;
  }

  const reports: TestReport[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      reports.push({ name, passed: true });
      console.log(`[PASS] ${name}`);
    } else {
      reports.push({ name, passed: false, error: message || "Assertion failed" });
      console.error(`[FAIL] ${name}: ${message || "Assertion failed"}`);
    }
  }

  console.log("=== SADA Cookie & UX Preferences Verification Suite ===\n");

  // Step 1: Initial State Clean
  deleteCookie("sada_cookie_consent");
  deleteCookie("sada_reading_progress");
  deleteCookie("sada_reading_font_size");
  localStore.clear();

  assert("Initial consent is null", getCookieConsent() === null);
  assert("Default reading memory is allowed before rejection", isReadingMemoryEnabled() === true);

  // Step 2: Accept All & Enable Memory
  const consentAll = saveCookieConsent("accepted_all");
  assert("Consent saved as accepted_all", consentAll.status === "accepted_all");
  assert("Necessary cookies enabled", consentAll.preferences.necessary === true);
  assert("Reading experience enabled", consentAll.preferences.readingExperience === true);
  assert("Analytics enabled", consentAll.preferences.analytics === true);
  assert("isReadingMemoryEnabled returns true", isReadingMemoryEnabled() === true);

  // Step 3: Save Reading Progress
  saveReadingProgress({
    slug: "brand-strategy-2026",
    title: "Brand Strategy for 2026",
    progressPercent: 45,
    scrollY: 1250,
  });

  const progress = getReadingProgress("brand-strategy-2026");
  assert("Reading progress exists", progress !== null);
  assert("Reading progress percent is 45%", progress?.progressPercent === 45);
  assert("Reading scrollY is 1250px", progress?.scrollY === 1250);

  // Step 4: Font Sizing
  assert("Initial font size defaults to normal", getReadingFontSize() === "normal");
  setReadingFontSize("relaxed");
  assert("Font size updated to relaxed", getReadingFontSize() === "relaxed");
  setReadingFontSize("large");
  assert("Font size updated to large", getReadingFontSize() === "large");

  // Step 5: Necessary Only (Privacy Purge Invariant)
  const consentNecessary = saveCookieConsent("necessary_only");
  assert("Consent updated to necessary_only", consentNecessary.status === "necessary_only");
  assert("Reading experience disabled", consentNecessary.preferences.readingExperience === false);
  assert("Analytics disabled", consentNecessary.preferences.analytics === false);
  assert("isReadingMemoryEnabled returns false", isReadingMemoryEnabled() === false);

  // Verify memory was purged
  assert("Reading progress purged from storage", getReadingProgress("brand-strategy-2026") === null);

  // Verify saveReadingProgress is blocked when disabled
  saveReadingProgress({
    slug: "blocked-article",
    title: "Should Not Save",
    progressPercent: 70,
    scrollY: 2000,
  });
  assert("Blocked article was not saved after consent rejected", getReadingProgress("blocked-article") === null);

  // Step 6: Custom Granular Consent
  const consentCustom = saveCookieConsent("custom", {
    readingExperience: true,
    analytics: false,
  });
  assert("Custom consent status recorded", consentCustom.status === "custom");
  assert("Custom readingExperience is true", consentCustom.preferences.readingExperience === true);
  assert("Custom analytics is false", consentCustom.preferences.analytics === false);
  assert("isReadingMemoryEnabled restored to true", isReadingMemoryEnabled() === true);

  saveReadingProgress({
    slug: "restored-article",
    title: "Restored Article",
    progressPercent: 30,
    scrollY: 800,
  });
  assert("New progress allowed after custom re-enabling", getReadingProgress("restored-article")?.progressPercent === 30);

  // Summary
  const failed = reports.filter(r => !r.passed);
  console.log(`\n========================================`);
  console.log(`Total Assertions: ${reports.length}`);
  console.log(`Passed: ${reports.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`========================================\n`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

runCookieTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
