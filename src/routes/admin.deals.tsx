import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/deals")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sales", replace: true });
  },
});

