import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/client-workspaces")({
  component: ClientWorkspacesLayout,
});

function ClientWorkspacesLayout() {
  return <Outlet />;
}
