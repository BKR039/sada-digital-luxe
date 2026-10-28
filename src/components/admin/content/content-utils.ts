// ============================================================
// SADA OS — Content System Shared Utilities
// Used by the Blog, Digital Products and Client Proof CMS.
// ============================================================

export type ContentStatus = "draft" | "scheduled" | "published";

/** URL-safe slug. Same rules as the Case Studies CMS so links behave identically. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Editorial status of a record.
 * A post flagged published with a future `published_at` is SCHEDULED — the
 * database RLS policy keeps it private until that timestamp passes.
 */
export function deriveStatus(row: {
  published?: boolean | null;
  published_at?: string | null;
}): ContentStatus {
  if (!row.published) return "draft";
  if (row.published_at && new Date(row.published_at).getTime() > Date.now()) return "scheduled";
  return "published";
}

export const STATUS_META: Record<
  ContentStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  published: {
    label: "Published",
    badgeClass: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
    dotClass: "bg-green-500",
  },
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
    dotClass: "bg-sky-500",
  },
  draft: {
    label: "Draft",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    dotClass: "bg-amber-500",
  },
};

/** Short, human date. Returns an em dash for missing values rather than "Invalid Date". */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative "updated" label for list rows. */
export function formatRelative(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** Price label. Free is a real state, not a missing value. */
export function formatPrice(price?: number | null, currency?: string | null): string {
  if (price === null || price === undefined || Number.isNaN(price)) return "—";
  if (price === 0) return "Free";
  return `${(currency || "USD").toUpperCase()} ${price}`;
}

export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Estimated reading time for the blog editor, from the same text the public page renders. */
export function estimateReadingMinutes(content: string | null | undefined): number {
  if (!content) return 0;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Currencies SADA actually sells in. Kept here so the option list has one home. */
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "TND", label: "TND — Tunisian Dinar" },
];

/** Languages a client quote can be recorded in. */
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
];

export type SortKey = "recent" | "oldest" | "title" | "order";

export const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "order", label: "Manual order" },
];
