import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clients/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/client-workspaces", replace: true });
  },
});
