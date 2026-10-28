import type { Language } from "./types";
import { useTranslation } from "./index";

/**
 * Deterministically resolves a field from a CMS entity based on the active language.
 * Follows strict fallback policy:
 * - If lang === 'ar': returns entity[field + '_ar'] if present and non-empty;
 *   otherwise falls back to entity[field] or entity[field + '_en'].
 * - If lang === 'en': returns entity[field + '_en'] || entity[field].
 */
export function getLocalizedContent<T extends Record<string, any>>(
  entity: T | null | undefined,
  field: string,
  lang: Language = "en"
): string {
  if (!entity) return "";

  if (lang === "ar") {
    const arVal = entity[`${field}_ar`];
    if (arVal !== undefined && arVal !== null && String(arVal).trim() !== "") {
      return String(arVal);
    }
  }

  const enVal = entity[`${field}_en`] ?? entity[field];
  return enVal !== undefined && enVal !== null ? String(enVal) : "";
}

/**
 * Hook for consuming localized CMS fields within React components.
 */
export function useLocalizedContent() {
  const { language } = useTranslation();

  return {
    getLocalized: <T extends Record<string, any>>(entity: T | null | undefined, field: string): string => {
      return getLocalizedContent(entity, field, language);
    },
    language,
  };
}
