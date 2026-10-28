import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { en } from "./locales/en";
import { ar } from "./locales/ar";
import type { Language, Direction, TranslationSchema } from "./types";

export * from "./types";

interface I18nContextValue {
  language: Language;
  direction: Direction;
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, maybeParams?: Record<string, string | number>) => string;
}

const dictionaries: Record<Language, TranslationSchema> = { en, ar };

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  direction: "ltr",
  isRTL: false,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>) =>
    typeof fallbackOrParams === "string" ? fallbackOrParams : key,
});

const STORAGE_KEY = "sada-lang";

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get("lang");
    if (urlLang === "ar" || urlLang === "en") return urlLang;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
    const docLang = document.documentElement.lang as Language;
    if (docLang === "ar" || docLang === "en") return docLang;
  } catch {}
  return "en";
}

function applyHtmlAttributes(lang: Language) {
  if (typeof document === "undefined") return;
  const dir: Direction = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  document.documentElement.setAttribute("data-lang", lang);
  if (lang === "ar") {
    document.documentElement.classList.add("rtl");
  } else {
    document.documentElement.classList.remove("rtl");
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Sync HTML attributes on mount and on language state change
  useEffect(() => {
    applyHtmlAttributes(language);
  }, [language]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {}

    applyHtmlAttributes(newLang);

    // Sync URL search param without full reload
    try {
      const url = new URL(window.location.href);
      if (newLang === "ar") {
        url.searchParams.set("lang", "ar");
      } else {
        url.searchParams.delete("lang");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "ar" : "en");
  }, [language, setLanguage]);

  // Nested property lookup with fallback to English and string fallback
  const t = useCallback(
    (key: string, fallbackOrParams?: string | Record<string, string | number>, maybeParams?: Record<string, string | number>): string => {
      const fallbackStr = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
      const params = typeof fallbackOrParams === "object" ? fallbackOrParams : maybeParams;

      const currentDict = dictionaries[language];
      const fallbackDict = dictionaries.en;

      const resolve = (obj: any, path: string): any => {
        return path.split(".").reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
      };

      let result = resolve(currentDict, key);
      if ((result === undefined || result === "") && !key.startsWith("admin.")) {
        result = resolve(currentDict, `admin.${key}`);
      }
      if ((result === undefined || result === "") && key.startsWith("common.actions.")) {
        result = resolve(currentDict, key.replace("common.actions.", "admin.actions."));
      }
      if (result === undefined || result === "") {
        result = resolve(fallbackDict, key);
        if ((result === undefined || result === "") && !key.startsWith("admin.")) {
          result = resolve(fallbackDict, `admin.${key}`);
        }
        if ((result === undefined || result === "") && key.startsWith("common.actions.")) {
          result = resolve(fallbackDict, key.replace("common.actions.", "admin.actions."));
        }
      }
      if (result === undefined || result === "") {
        if (key === "common.actions.view") {
          result = language === "ar" ? "عرض" : "View";
        } else if (fallbackStr !== undefined) {
          result = fallbackStr;
        } else {
          return key;
        }
      }

      if (typeof result === "object" && result !== null) {
        if (typeof result.nav === "string") result = result.nav;
        else if (typeof result.label === "string") result = result.label;
        else if (typeof result.title === "string") result = result.title;
        else if (typeof result.name === "string") result = result.name;
      }

      if (typeof result === "string" && params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          if (pVal !== undefined && pVal !== null) {
            result = result.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
          }
        });
      }

      return typeof result === "string" ? result : (fallbackStr || key);
    },
    [language]
  );

  const direction: Direction = language === "ar" ? "rtl" : "ltr";
  const isRTL = direction === "rtl";

  const value = useMemo(
    () => ({
      language,
      direction,
      isRTL,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, direction, isRTL, setLanguage, toggleLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useTranslation = useI18n;
