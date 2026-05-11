import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`relative h-9 w-9 rounded-full grid place-items-center border border-border bg-card hover:bg-muted transition-colors ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-0 grid place-items-center"
        >
          {isDark ? <Moon className="size-4 text-foreground" /> : <Sun className="size-4 text-foreground" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
