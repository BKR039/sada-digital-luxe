import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/business-rules")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/business-rules", replace: true });
  },
  component: () => null,
});
