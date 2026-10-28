import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/client-projects")({
  component: ClientProjectsLayout,
});

function ClientProjectsLayout() {
  return <Outlet />;
}
