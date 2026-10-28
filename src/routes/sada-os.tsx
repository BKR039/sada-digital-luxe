import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep old bookmarks working while sending everyone directly to the dashboard.
export const Route = createFileRoute("/sada-os")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
