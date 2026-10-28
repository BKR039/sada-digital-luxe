import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/salary")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/my-salary", replace: true });
  },
});
