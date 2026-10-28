import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return <Outlet />;
}
