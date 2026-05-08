import { Outlet, useRouterState } from "@tanstack/react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/admin");
  const isAuth = path.startsWith("/auth");
  if (isAdmin || isAuth) return <Outlet />;
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="relative pt-24 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
