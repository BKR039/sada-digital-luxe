import { Outlet, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PageTransition } from "./PageTransition";

const AIAssistant = lazy(() =>
  import("./AIAssistant").then((m) => ({ default: m.AIAssistant })),
);

export function SiteLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/admin") || path.startsWith("/sada-os");
  const isAuth = path.startsWith("/auth");
  if (isAdmin || isAuth) return <Outlet />;

  const isHome = path === "/";

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className={`relative flex-1 flex flex-col ${isHome ? "" : "pt-24"}`}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <AIAssistant />
      </Suspense>
    </div>
  );
}
