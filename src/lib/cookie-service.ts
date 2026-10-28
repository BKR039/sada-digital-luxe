/**
 * SADA OS — Cookie & UX Preferences Service
 * Handles necessary cookies, reading progress, and privacy preferences.
 */

export interface CookiePreferences {
  necessary: boolean; // Always true (language, theme, auth, navigation)
  readingExperience: boolean; // Reading progress, font size, bookmarks
  analytics: boolean; // Anonymous performance metrics
}

export interface StoredCookieConsent {
  status: "accepted_all" | "necessary_only" | "custom";
  timestamp: string;
  preferences: CookiePreferences;
}

export interface ReadingProgressData {
  slug: string;
  title: string;
  progressPercent: number;
  scrollY: number;
  updatedAt: string;
}

const CONSENT_COOKIE_KEY = "sada_cookie_consent";
const READING_FONT_SIZE_KEY = "sada_reading_font_size";
const READING_PROGRESS_KEY = "sada_reading_progress";
const READING_COOKIE_SLUGS_KEY = "sada_reading_slugs";
const RECENT_READS_KEY = "sada_recent_reads";

/**
 * Standard cookie reader
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + encodeURIComponent(name) + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Standard cookie setter with 365 days expiry and SameSite=Lax
 */
export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isHttps ? "; Secure" : ""}`;
  
  // Mirror to localStorage for instant synchronous hydration
  try {
    localStorage.setItem(name, value);
  } catch (_) {}
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(name);
  } catch (_) {}
}

/**
 * Get current cookie consent status
 */
export function getCookieConsent(): StoredCookieConsent | null {
  try {
    const raw = getCookie(CONSENT_COOKIE_KEY) || (typeof localStorage !== "undefined" ? localStorage.getItem(CONSENT_COOKIE_KEY) : null);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save user cookie consent preferences
 */
export function saveCookieConsent(
  status: "accepted_all" | "necessary_only" | "custom",
  customPrefs?: Partial<CookiePreferences>
): StoredCookieConsent {
  const preferences: CookiePreferences = {
    necessary: true,
    readingExperience: status === "accepted_all" || (customPrefs?.readingExperience ?? false),
    analytics: status === "accepted_all" || (customPrefs?.analytics ?? false),
  };

  const record: StoredCookieConsent = {
    status,
    timestamp: new Date().toISOString(),
    preferences,
  };

  setCookie(CONSENT_COOKIE_KEY, JSON.stringify(record), 365);

  // If reading experience is turned off, immediately purge cached reading progress
  if (!preferences.readingExperience) {
    deleteCookie(READING_PROGRESS_KEY);
    deleteCookie(READING_COOKIE_SLUGS_KEY);
    deleteCookie(READING_FONT_SIZE_KEY);
    try {
      localStorage.removeItem(READING_PROGRESS_KEY);
      localStorage.removeItem(RECENT_READS_KEY);
      localStorage.removeItem(READING_COOKIE_SLUGS_KEY);
      localStorage.removeItem(READING_FONT_SIZE_KEY);
    } catch (_) {}
  }

  // Notify active listeners across the app
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("sada:cookie-consent-updated", { detail: record }));
    } catch (_) {}
  }

  return record;
}

/**
 * Check if reading memory is allowed by current user consent
 */
export function isReadingMemoryEnabled(): boolean {
  const consent = getCookieConsent();
  if (!consent) return true; // Allowed by default until user restricts
  return consent.preferences.readingExperience;
}

/**
 * Reading Experience: Save blog reading progress
 */
export function saveReadingProgress(data: { slug: string; title: string; progressPercent: number; scrollY: number }): void {
  if (!isReadingMemoryEnabled()) {
    return;
  }

  if (typeof localStorage === "undefined") return;

  try {
    const raw = localStorage.getItem(READING_PROGRESS_KEY);
    const map: Record<string, ReadingProgressData> = raw ? JSON.parse(raw) : {};
    
    map[data.slug] = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(map));
    setCookie(READING_COOKIE_SLUGS_KEY, JSON.stringify(Object.keys(map).slice(-10)), 180);

    // Track recently read slugs
    const recentsRaw = localStorage.getItem(RECENT_READS_KEY);
    const recents: string[] = recentsRaw ? JSON.parse(recentsRaw) : [];
    if (!recents.includes(data.slug)) {
      recents.unshift(data.slug);
      localStorage.setItem(RECENT_READS_KEY, JSON.stringify(recents.slice(0, 15)));
    }
  } catch (_) {}
}

/**
 * Reading Experience: Get saved reading progress for an article
 */
export function getReadingProgress(slug: string): ReadingProgressData | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(READING_PROGRESS_KEY);
    if (!raw) return null;
    const map: Record<string, ReadingProgressData> = JSON.parse(raw);
    return map[slug] || null;
  } catch {
    return null;
  }
}

/**
 * Reading Experience: Get or set article reading font size
 */
export function getReadingFontSize(): "normal" | "relaxed" | "large" {
  try {
    const fromCookie = getCookie(READING_FONT_SIZE_KEY);
    const fromStorage = typeof localStorage !== "undefined" ? localStorage.getItem(READING_FONT_SIZE_KEY) : null;
    const val = fromCookie || fromStorage;
    if (val === "relaxed" || val === "large" || val === "normal") return val;
    return "normal";
  } catch {
    return "normal";
  }
}

export function setReadingFontSize(size: "normal" | "relaxed" | "large"): void {
  try {
    setCookie(READING_FONT_SIZE_KEY, size, 365);
  } catch (_) {}
}
