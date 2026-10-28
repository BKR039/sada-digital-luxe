import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/testimonials")({
  component: TestimonialsLayout,
});

function TestimonialsLayout() {
  return <Outlet />;
}
