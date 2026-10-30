import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { isStandaloneApp } from "@/lib/pwa-service";

const MINIMUM_SPLASH_MS = 1_050;

/** Shows the supplied brand splash only when the installed PWA starts. */
export function PwaLaunchScreen() {
  const { loading } = useAuth();
  const startedAt = useRef(0);
  const [standalone, setStandalone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!isStandaloneApp()) return;
    startedAt.current = Date.now();
    setStandalone(true);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!standalone || loading) return;
    const remaining = Math.max(0, MINIMUM_SPLASH_MS - (Date.now() - startedAt.current));
    let hideTimer: number | undefined;
    const dismissTimer = window.setTimeout(() => {
      setFading(true);
      hideTimer = window.setTimeout(() => setVisible(false), 260);
    }, remaining);
    return () => {
      window.clearTimeout(dismissTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [loading, standalone]);

  // Never leave the launch image covering the app if auth/bootstrap stalls.
  useEffect(() => {
    if (!standalone) return;
    const failsafe = window.setTimeout(() => {
      setFading(true);
      window.setTimeout(() => setVisible(false), 260);
    }, 8_000);
    return () => window.clearTimeout(failsafe);
  }, [standalone]);

  if (!visible) return null;

  return (
    <div
      aria-label="SADA OS"
      className={`fixed inset-0 z-[10000] h-[100dvh] w-screen bg-[#222830] transition-opacity duration-[260ms] ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <img
        src="/pwa-launch-screen.png?v=1"
        alt="نصنع أثراً"
        className="h-full w-full object-cover"
        fetchPriority="high"
      />
    </div>
  );
}
