// ============================================================
// SADA OS — DYNAMIC BROWSER TAB & FAVICON BADGE ENGINE
// Phase 5: Operating System Grade Tab & Favicon Presence
// Dynamically superimposes unread badge on SADA Luxe Favicon
// and coordinates tab title notification count prefix.
// ============================================================

let baseDocumentTitle: string = "";
let currentFaviconHref: string = "/favicon.svg";
let currentTrackedUnreadCount = 0;
let isInternallyUpdatingTitle = false;
let titleMutationObserver: MutationObserver | null = null;

/**
 * Captures or extracts the base document title (without any (N) prefix).
 */
export function getCleanDocumentTitle(): string {
  if (typeof document === "undefined") return "SADA OS";
  const raw = document.title || "SADA OS";
  return raw.replace(/^\(\d+\+?\)\s*/, "").trim();
}

/**
 * Initializes Title MutationObserver so router title mutations automatically
 * preserve the unread count prefix.
 */
function ensureTitleObserver(): void {
  if (typeof document === "undefined" || titleMutationObserver) return;

  const titleEl = document.querySelector("title");
  if (!titleEl) return;

  titleMutationObserver = new MutationObserver(() => {
    if (isInternallyUpdatingTitle) return;
    if (currentTrackedUnreadCount > 0) {
      updateBrowserTitleBadge(currentTrackedUnreadCount);
    }
  });

  titleMutationObserver.observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/**
 * Builds a dynamic SVG data URI that renders the official SADA luxe dark
 * rounded icon and superimposes a high-contrast badge counter on top-right.
 */
export function generateBadgedFaviconSvg(count: number): string {
  const displayCount = count > 99 ? "99+" : `${count}`;
  const isMultiDigit = count > 9;
  const isTripleDigit = count > 99;

  // SADA's dark rounded rect base (#07090E with rx="7") + white/cyan bars
  // Plus high-contrast badge on top-right
  const badgeCx = isTripleDigit ? 21.5 : isMultiDigit ? 22 : 23;
  const badgeCy = 8;
  const badgeR = isTripleDigit ? 8.5 : isMultiDigit ? 7.5 : 6.5;
  const textX = badgeCx;
  const textY = badgeCy + (isTripleDigit ? 2.6 : 3.2);
  const fontSize = isTripleDigit ? 6.5 : isMultiDigit ? 7.5 : 8.5;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="favAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#818CF8" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EF4444" />
      <stop offset="100%" stop-color="#E11D48" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="#07090E" />
  <g transform="translate(4.5, 7)">
    <path d="M 0 3 C 0 1 1 0 3 0 L 15 0 C 17 0 18 1 18 3 L 18 4 L 0 4 Z" fill="#FFFFFF" opacity="0.9" />
    <rect x="0" y="6" width="18" height="1.5" rx="0.75" fill="#FFFFFF" opacity="0.8" />
    <rect x="0" y="9" width="18" height="1.5" rx="0.75" fill="url(#favAccent)" />
    <rect x="0" y="12" width="18" height="1.5" rx="0.75" fill="#FFFFFF" opacity="0.8" />
    <path d="M 0 14 L 18 14 L 18 15 C 18 17 17 18 15 18 L 3 18 C 1 18 0 17 0 15 Z" fill="#FFFFFF" opacity="0.9" />
  </g>
  <!-- SADA Notification Badge -->
  <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR + 1.2}" fill="#07090E" />
  <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="url(#badgeGrad)" />
  <text x="${textX}" y="${textY}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="800" fill="#FFFFFF" text-anchor="middle">${displayCount}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Updates the browser favicon link element with either the badged SVG or default favicon.
 */
export function updateBrowserFaviconBadge(count: number): void {
  if (typeof document === "undefined") return;

  try {
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      document.head.appendChild(link);
    }

    if (count > 0) {
      const badgedHref = generateBadgedFaviconSvg(count);
      link.href = badgedHref;
      link.type = "image/svg+xml";
    } else {
      link.href = "/favicon.svg";
      link.type = "image/svg+xml";
    }
  } catch (err) {
    console.warn("[updateBrowserFaviconBadge] Notice:", err);
  }
}

/**
 * Updates document.title to reflect the current unread count:
 * e.g. "(3) SADA OS" or restoring the base title when 0.
 */
export function updateBrowserTitleBadge(count: number): void {
  if (typeof document === "undefined") return;

  try {
    ensureTitleObserver();

    if (!baseDocumentTitle) {
      baseDocumentTitle = getCleanDocumentTitle();
    }

    const cleanTitle = getCleanDocumentTitle();
    const effectiveBase = cleanTitle || baseDocumentTitle || "SADA OS";

    isInternallyUpdatingTitle = true;
    try {
      if (count > 0) {
        const displayCount = count > 99 ? "99+" : `${count}`;
        document.title = `(${displayCount}) ${effectiveBase}`;
      } else {
        document.title = effectiveBase;
      }
    } finally {
      // Release mutex on next tick
      setTimeout(() => {
        isInternallyUpdatingTitle = false;
      }, 0);
    }
  } catch (err) {
    console.warn("[updateBrowserTitleBadge] Notice:", err);
  }
}

/**
 * Canonical synchronization method for browser tab badge state.
 * Call this whenever the unread count changes.
 */
export function syncBrowserTabBadge(unreadCount: number): void {
  currentTrackedUnreadCount = unreadCount;
  updateBrowserFaviconBadge(unreadCount);
  updateBrowserTitleBadge(unreadCount);
}

/**
 * Resets browser tab badge and restores original title and favicon.
 */
export function resetBrowserTabBadge(): void {
  syncBrowserTabBadge(0);
}
