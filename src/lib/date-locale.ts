import {
  format as dfFormat,
  formatDistanceToNow as dfFormatDistanceToNow,
  formatRelative as dfFormatRelative,
  parseISO,
  isValid,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  differenceInDays,
  differenceInMinutes,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  type FormatOptions,
} from "date-fns";
import { arSA, enUS } from "date-fns/locale";

export {
  parseISO,
  isValid,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  differenceInDays,
  differenceInMinutes,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
};

/**
 * Detect current active UI language from document or localStorage
 */
export function getActiveLanguage(): "en" | "ar" {
  if (typeof document !== "undefined") {
    const docLang = document.documentElement.lang;
    if (docLang === "ar" || docLang === "en") return docLang;
  }
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("sada-lang");
      if (saved === "ar" || saved === "en") return saved;
    } catch {}
  }
  return "en";
}

export function getDateLocale(lang?: "en" | "ar") {
  const active = lang || getActiveLanguage();
  return active === "ar" ? arSA : enUS;
}

/**
 * Format a Date or ISO string with automatic Arabic/English locale support
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  formatStr: string = "d MMM yyyy",
  options?: FormatOptions & { lang?: "en" | "ar" }
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    if (!isValid(d)) return "—";

    const locale = getDateLocale(options?.lang);
    return dfFormat(d, formatStr, {
      locale,
      ...options,
    });
  } catch {
    return "—";
  }
}

/**
 * Relative time from now (e.g. "منذ 3 ساعات" or "3 hours ago")
 */
export function formatRelativeTime(
  date: Date | string | number | null | undefined,
  options?: { addSuffix?: boolean; lang?: "en" | "ar" }
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    if (!isValid(d)) return "—";

    const locale = getDateLocale(options?.lang);
    return dfFormatDistanceToNow(d, {
      addSuffix: options?.addSuffix ?? true,
      locale,
    });
  } catch {
    return "—";
  }
}

/**
 * Localized relative date badge label ("Today" / "اليوم", "Tomorrow" / "غداً", "Yesterday" / "أمس", etc.)
 */
export function getRelativeDayLabel(
  date: Date | string | number,
  lang?: "en" | "ar"
): { label: string; isSpecial: boolean; isPastDue: boolean } {
  const activeLang = lang || getActiveLanguage();
  const d = typeof date === "string" ? parseISO(date) : new Date(date);

  if (!isValid(d)) {
    return { label: "—", isSpecial: false, isPastDue: false };
  }

  if (isToday(d)) {
    return {
      label: activeLang === "ar" ? "اليوم" : "Today",
      isSpecial: true,
      isPastDue: false,
    };
  }

  if (isTomorrow(d)) {
    return {
      label: activeLang === "ar" ? "غداً" : "Tomorrow",
      isSpecial: true,
      isPastDue: false,
    };
  }

  if (isYesterday(d)) {
    return {
      label: activeLang === "ar" ? "أمس" : "Yesterday",
      isSpecial: true,
      isPastDue: true,
    };
  }

  const past = isPast(d);
  return {
    label: formatDate(d, "d MMM", { lang: activeLang }),
    isSpecial: false,
    isPastDue: past,
  };
}
