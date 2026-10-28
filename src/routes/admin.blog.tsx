import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return <Outlet />;
}
