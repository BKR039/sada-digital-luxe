import { createFileRoute, redirect } from "@tanstack/react-router";
import { SalesWorkspaceView } from "@/components/admin/SalesWorkspaceView";

export const Route = createFileRoute("/admin/sales")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hasAuthToken = Object.keys(localStorage).some(
        (key) => (key.startsWith("sb-") && key.endsWith("-auth-token")) || key === "supabase.auth.token"
      );
      if (!hasAuthToken) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: SalesWorkspaceView,
});
