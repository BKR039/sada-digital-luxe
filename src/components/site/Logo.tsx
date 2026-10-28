import logoLight from "@/assets/sada-logo-light.svg";
import logoDark from "@/assets/sada-logo-dark.svg";
import { useTheme } from "@/lib/theme";

export function Logo({ className = "", forceDark = false }: { className?: string; forceDark?: boolean }) {
  const { theme } = useTheme();
  const isDark = forceDark || theme === "dark";
  return (
    <div className={`flex items-center ${className}`}>
      <img src={isDark ? logoDark : logoLight} alt="SADA" className="h-8 w-auto" />
    </div>
  );
}

