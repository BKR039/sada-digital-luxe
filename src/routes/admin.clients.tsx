import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clients")({
  component: ClientsLayout,
});

function ClientsLayout() {
  return <Outlet />;
}
