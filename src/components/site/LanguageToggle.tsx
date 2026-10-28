import { useTranslation } from "@/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage, isRTL } = useTranslation();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border bg-card/80 p-0.5 text-xs backdrop-blur-md transition-colors ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-label="Switch to English"
        className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium transition-all ${
          language === "en"
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-[11px] uppercase tracking-wider">EN</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage("ar")}
        aria-label="التبديل إلى العربية"
        className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium transition-all ${
          language === "ar"
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-[11px] font-semibold">عربي</span>
      </button>
    </div>
  );
}
