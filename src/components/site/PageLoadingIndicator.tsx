import { useEffect, useState, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

export function PageLoadingIndicator() {
  const isNavigating = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading || s.isTransitioning,
  });

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isNavigating) {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisible(true);
      setActive(true);
      setProgress(15);

      // Smooth, natural progress curve
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 85;
          }
          const increment = Math.max(1, (85 - prev) * 0.15);
          return Math.min(85, prev + increment);
        });
      }, 80);
    } else if (active) {
      if (timerRef.current) clearInterval(timerRef.current);
      // Shoot to 100% when route finishes
      setProgress(100);

      const hideTimer = setTimeout(() => {
        setVisible(false);
        setActive(false);
        setProgress(0);
      }, 250);

      return () => clearTimeout(hideTimer);
    }
  }, [isNavigating, active]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-[10000] h-[2.5px] pointer-events-none bg-transparent"
    >
      <div
        className="relative h-full bg-gradient-to-r from-cyan-400 via-primary to-blue-500 shadow-[0_0_12px_rgba(56,189,248,0.85)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 120ms ease-out, opacity 200ms ease-out 100ms" : "width 200ms ease-out",
        }}
      >
        {/* Leading Glow Sparkle */}
        <div className="absolute top-0 end-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/40 to-white shadow-[0_0_8px_#fff]" />
      </div>
    </div>
  );
}
