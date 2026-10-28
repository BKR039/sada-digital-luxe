import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/commissions")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sales", replace: true });
  },
});

